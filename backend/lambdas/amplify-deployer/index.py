"""Amplify Deployer - Custom Resource for One-Click Deployments"""
import json
import logging
import os
import urllib.request

import boto3
from crhelper import CfnResource

logger = logging.getLogger(__name__)
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

helper = CfnResource(json_logging=True, log_level="INFO")
amplify = boto3.client("amplify")
s3 = boto3.client("s3")


@helper.create
@helper.update
def create_or_update(event, context):
    """Deploy frontend to Amplify from S3 source."""
    props = event.get("ResourceProperties", {})
    app_id = props["AppId"]
    branch_name = props["BranchName"]
    source_bucket = props["SourceBucket"]
    source_key = props["SourceKey"]

    # 1. Download source zip from S3
    logger.info(f"Downloading source from s3://{source_bucket}/{source_key}")
    response = s3.get_object(Bucket=source_bucket, Key=source_key)
    zip_data = response["Body"].read()

    # 2. Create Amplify deployment (get presigned upload URL)
    logger.info(f"Creating deployment for app {app_id}, branch {branch_name}")
    deployment = amplify.create_deployment(appId=app_id, branchName=branch_name)
    upload_url = deployment["zipUploadUrl"]
    job_id = deployment["jobId"]

    # 3. Upload zip to presigned URL
    logger.info(f"Uploading {len(zip_data)} bytes to Amplify")
    req = urllib.request.Request(upload_url, data=zip_data, method="PUT")
    req.add_header("Content-Type", "application/zip")
    urllib.request.urlopen(req)

    # 4. Start deployment
    logger.info(f"Starting deployment job {job_id}")
    amplify.start_deployment(appId=app_id, branchName=branch_name, jobId=job_id)

    helper.Data["JobId"] = job_id
    helper.Data["AppId"] = app_id
    helper.Data["BranchName"] = branch_name


@helper.poll_create
@helper.poll_update
def poll(event, context):
    """Poll Amplify deployment until complete."""
    data = event.get("CrHelperData", {})
    app_id = data["AppId"]
    branch_name = data["BranchName"]
    job_id = data["JobId"]

    response = amplify.get_job(appId=app_id, branchName=branch_name, jobId=job_id)
    status = response["job"]["summary"]["status"]

    logger.info(f"Deployment status: {status}")

    if status == "SUCCEED":
        return True
    elif status in ("PENDING", "PROVISIONING", "RUNNING"):
        return None  # Keep polling
    else:
        raise RuntimeError(f"Deployment failed: {status}")


@helper.delete
def delete(event, context):
    """No action needed on delete."""
    logger.info("Delete - no action required")


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event, default=str)}")
    return helper(event, context)
