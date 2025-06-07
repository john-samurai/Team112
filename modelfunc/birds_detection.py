#!/usr/bin/env python
# coding: utf-8

import json
import boto3
import os
import tempfile
import logging
from urllib.parse import unquote_plus
from datetime import datetime

# Set OpenCV environment before importing
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '0'
os.environ['QT_QPA_PLATFORM'] = 'offscreen'

from ultralytics import YOLO
import supervision as sv
import cv2 as cv
import numpy as np

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Global variables for model caching
model = None
class_dict = None

def download_model_from_s3():
    """Download YOLO model from S3 to local temp directory"""
    global model, class_dict
    
    if model is not None:
        logger.info("Model already loaded, skipping download")
        return
    
    try:
        # Model details in S3
        MODEL_S3_BUCKET = os.environ.get('MODEL_S3_BUCKET', 'bird112-main-model')
        MODEL_S3_KEY = os.environ.get('MODEL_S3_KEY', 'models/model.pt')
        MODEL_LOCAL_PATH = '/tmp/model.pt'
        
        logger.info(f"Model S3 location: s3://{MODEL_S3_BUCKET}/{MODEL_S3_KEY}")
        
        # Download the model from S3 at startup
        if not os.path.exists(MODEL_LOCAL_PATH):
            logger.info(f"Downloading model from s3://{MODEL_S3_BUCKET}/{MODEL_S3_KEY} to {MODEL_LOCAL_PATH}")
            s3_client.download_file(MODEL_S3_BUCKET, MODEL_S3_KEY, MODEL_LOCAL_PATH)
            logger.info("Model downloaded successfully")
        else:
            logger.info("Model already exists locally, skipping download")
        
        # Load YOLO model with verbose=False to reduce output
        logger.info("Loading YOLO model...")
        model = YOLO(MODEL_LOCAL_PATH)
        class_dict = model.names
        
        logger.info(f"Model loaded successfully. Classes: {len(class_dict)}")
        logger.info(f"Available classes: {list(class_dict.values())}")
        
    except Exception as e:
        logger.error(f"Error downloading/loading model: {str(e)}")
        raise

def lambda_handler(event, context):
    """
    Main Lambda handler for bird detection
    Triggered by S3 file upload
    """
    try:
        logger.info("Lambda function started")
        logger.info(f"Event: {json.dumps(event)}")
        
        # Download model if not already loaded
        download_model_from_s3()
        
        # Get DynamoDB table name
        table_name = os.environ['DYNAMODB_TABLE']
        table = dynamodb.Table(table_name)
        logger.info(f"Using DynamoDB table: {table_name}")
        
        # Process S3 events
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            logger.info(f"Processing file: {bucket}/{key}")
            
            # Skip thumbnail files
            if '-thumb.' in key:
                logger.info("Skipping thumbnail file")
                continue
            
            # Download file from S3
            with tempfile.TemporaryDirectory() as temp_dir:
                local_path = os.path.join(temp_dir, os.path.basename(key))
                logger.info(f"Downloading {key} to {local_path}")
                s3_client.download_file(bucket, key, local_path)
                
                # Detect file type and process
                file_type = get_file_type(key)
                logger.info(f"File type detected: {file_type}")
                
                if file_type == 'image':
                    detections = process_image(local_path)
                elif file_type == 'video':
                    detections = process_video(local_path)
                else:
                    logger.warning(f"Unsupported file type: {key}")
                    continue
                
                # Store results in DynamoDB
                store_detection_results(table, bucket, key, file_type, detections)
                
                logger.info(f"Processed {key}: {len(detections)} unique bird species detected")
        
        return {
            'statusCode': 200,
            'body': json.dumps('Bird detection completed successfully')
        }
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }

def get_file_type(filename):
    """Determine file type based on extension"""
    ext = filename.lower().split('.')[-1]
    
    if ext in ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'gif']:
        return 'image'
    elif ext in ['mp4', 'avi', 'mov', 'mkv', 'webm']:
        return 'video'
    else:
        return 'unknown'

def process_image(image_path, confidence=0.5):
    """
    Process image and detect birds using YOLO model
    Returns aggregated detection results
    """
    try:
        global model, class_dict
        
        # Load image
        img = cv.imread(image_path)
        if img is None:
            logger.error("Could not load image")
            return []
        
        logger.info(f"Processing image with shape: {img.shape}")
        
        # Run YOLO detection with verbose=False
        results = model(img, verbose=False)[0]
        
        # Convert to supervision format
        detections = sv.Detections.from_ultralytics(results)
        
        # Filter by confidence
        if detections.class_id is not None:
            detections = detections[detections.confidence > confidence]
            
            logger.info(f"Found {len(detections.class_id)} detections above confidence {confidence}")
            
            # Count occurrences of each bird species
            species_counts = {}
            for cls_id, conf in zip(detections.class_id, detections.confidence):
                species_name = class_dict[cls_id]
                
                if species_name in species_counts:
                    species_counts[species_name]['count'] += 1
                    # Keep highest confidence for this species
                    species_counts[species_name]['confidence'] = max(
                        species_counts[species_name]['confidence'], conf
                    )
                else:
                    species_counts[species_name] = {
                        'species': species_name,
                        'count': 1,
                        'confidence': float(conf)
                    }
            
            detection_results = list(species_counts.values())
            logger.info(f"Detected species: {detection_results}")
            return detection_results
        else:
            logger.info("No detections found")
            return []
        
    except Exception as e:
        logger.error(f"Error processing image {image_path}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return []

def process_video(video_path, confidence=0.5):
    """
    Process video and detect birds using YOLO model
    Returns aggregated detection results across all frames
    """
    try:
        global model, class_dict
        
        # Initialize video capture
        cap = cv.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error("Could not open video")
            return []
        
        # Get video info
        fps = int(cap.get(cv.CAP_PROP_FPS))
        total_frames = int(cap.get(cv.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Processing video: {fps} FPS, {total_frames} frames")
        
        # Sample frames (process every Nth frame to reduce processing time)
        sample_rate = max(1, fps // 2)  # Process 2 frames per second
        
        species_detections = {}
        frame_count = 0
        processed_frames = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Only process sampled frames
            if frame_count % sample_rate == 0:
                processed_frames += 1
                if processed_frames % 10 == 0:  # Log every 10th processed frame
                    logger.info(f"Processing frame {frame_count}/{total_frames}")
                
                # Run YOLO detection on frame with verbose=False
                results = model(frame, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(results)
                
                # Filter by confidence
                if detections.class_id is not None:
                    detections = detections[detections.confidence > confidence]
                    
                    # Count species in this frame
                    for cls_id, conf in zip(detections.class_id, detections.confidence):
                        species_name = class_dict[cls_id]
                        
                        if species_name in species_detections:
                            # Update max count seen in any frame
                            current_count = len([c for c in detections.class_id if c == cls_id])
                            species_detections[species_name]['count'] = max(
                                species_detections[species_name]['count'], 
                                current_count
                            )
                            # Update confidence
                            species_detections[species_name]['confidence'] = max(
                                species_detections[species_name]['confidence'], 
                                conf
                            )
                        else:
                            current_count = len([c for c in detections.class_id if c == cls_id])
                            species_detections[species_name] = {
                                'species': species_name,
                                'count': current_count,
                                'confidence': float(conf)
                            }
            
            frame_count += 1
        
        cap.release()
        
        detection_results = list(species_detections.values())
        logger.info(f"Video processing complete. Processed {processed_frames} frames. Detected species: {detection_results}")
        return detection_results
        
    except Exception as e:
        logger.error(f"Error processing video {video_path}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return []

def store_detection_results(table, bucket, key, file_type, detections):
    """Store detection results in DynamoDB"""
    try:
        # Create tags dictionary for easy querying
        tags = {}
        for detection in detections:
            tags[detection['species']] = detection['count']
        
        # Generate file URLs
        file_url = f"https://{bucket}.s3.amazonaws.com/{key}"
        thumbnail_url = None
        user_id = key.split('/')[0]
        filename = os.path.basename(key)
        file_id = os.path.splitext(filename)[0]

        if file_type == 'image':
            # Assume thumbnail will be created with -thumb suffix
            thumbnail_key = get_thumbnail_key(key)
            thumbnail_url = f"https://{bucket}.s3.ap-southeast-2.amazonaws.com/{thumbnail_key}"
        
        # Write metadata to DynamoDB
        tags = [
            {"species": detection["species"], "count": detection["count"]}
            for detection in detections
        ]
        item = {
            'id': file_id,
            'user_id': user_id,
            'file_url': file_url,
            'file_type': file_type,
            'tags': tags,
            'thumb_url': thumbnail_url,
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        table.put_item(Item=item)

        logger.info(f"Stored detection results for {key} in DynamoDB")
        logger.info(f"Tags stored: {tags}")
        
    except Exception as e:
        logger.error(f"Error storing results in DynamoDB: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise

def get_thumbnail_key(original_key):
    """Generate thumbnail S3 key from original key"""
    path_parts = original_key.rsplit('.', 1)
    if len(path_parts) == 2:
        name, ext = path_parts
        return f"{name}-thumb.jpg"
    else:
        return f"{original_key}-thumb.jpg"

# Test function for local development
def test_local():
    """Test function for local development"""
    print("Testing bird detection locally...")
    
    # Set up test environment
    os.environ['MODEL_S3_BUCKET'] = 'bird112-main-model'
    os.environ['MODEL_S3_KEY'] = 'models/model.pt'
    os.environ['DYNAMODB_TABLE'] = 'BirdDetections'
    
    # Test with local images
    test_images = [
        "./test_images/crows_1.jpg",
        "./test_images/kingfisher_2.jpg",
        "./test_images/myna_1.jpg"
    ]
    
    for image_path in test_images:
        if os.path.exists(image_path):
            print(f"\nTesting {image_path}...")
            detections = process_image(image_path)
            print(f"Detections: {detections}")

if __name__ == '__main__':
    test_local()