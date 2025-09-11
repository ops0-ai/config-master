#!/bin/bash

# Build and push multi-architecture Docker images to ECR
# Usage: ./build-and-push-ecr.sh [TAG] [PLATFORMS]
# 
# Examples:
#   ./build-and-push-ecr.sh                           # Default: latest tag, amd64+arm64
#   ./build-and-push-ecr.sh v2.0.0                    # Custom tag, amd64+arm64
#   ./build-and-push-ecr.sh latest "linux/amd64"      # Latest tag, amd64 only
#   ./build-and-push-ecr.sh v1.5.0 "linux/amd64,linux/arm64,linux/386"  # Custom tag, multiple archs

set -e

# Parse command line arguments
TAG=${1:-"latest"}
PLATFORMS=${2:-"linux/amd64,linux/arm64"}

# Configuration
ECR_REGISTRY="public.ecr.aws/l8i8q3c1/ops0"
IMAGE_NAME="hive-agent"

# Convert platforms to array for validation
IFS=',' read -ra PLATFORM_ARRAY <<< "$PLATFORMS"

# Validate supported architectures
SUPPORTED_ARCHS=("linux/amd64" "linux/arm64" "linux/386" "linux/arm")
for platform in "${PLATFORM_ARRAY[@]}"; do
    if [[ ! " ${SUPPORTED_ARCHS[@]} " =~ " ${platform} " ]]; then
        echo "❌ Unsupported platform: ${platform}"
        echo "Supported platforms: ${SUPPORTED_ARCHS[*]}"
        exit 1
    fi
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Building and pushing Pulse Hive Agent to ECR${NC}"
echo -e "${YELLOW}Registry: ${ECR_REGISTRY}/${IMAGE_NAME}${NC}"
echo -e "${YELLOW}Tag: ${TAG}${NC}"
echo -e "${YELLOW}Platforms: ${PLATFORMS}${NC}"

# Step 1: Ensure Docker buildx is available
echo -e "\n${GREEN}Step 1: Setting up Docker buildx${NC}"
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}Docker buildx is not available. Please update Docker.${NC}"
    exit 1
fi

# Create a new builder instance if it doesn't exist
BUILDER_NAME="pulse-hive-builder"
if ! docker buildx ls | grep -q ${BUILDER_NAME}; then
    echo "Creating new buildx builder: ${BUILDER_NAME}"
    docker buildx create --name ${BUILDER_NAME} --use
    docker buildx inspect --bootstrap
else
    echo "Using existing buildx builder: ${BUILDER_NAME}"
    docker buildx use ${BUILDER_NAME}
fi

# Step 2: Authenticate with ECR Public
echo -e "\n${GREEN}Step 2: Authenticating with ECR Public${NC}"
echo "Please ensure you have AWS CLI configured with appropriate credentials"
echo "Running: aws ecr-public get-login-password --region us-east-1"

aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

# Step 3: Build and push multi-architecture image
echo -e "\n${GREEN}Step 3: Building multi-architecture image${NC}"
echo "Building for platforms: ${PLATFORMS}"

# Build with specified tag
docker buildx build \
    --platform ${PLATFORMS} \
    --tag ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG} \
    --push \
    .

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Successfully built and pushed multi-architecture image!${NC}"
    echo -e "${GREEN}Image pushed:${NC}"
    echo -e "  - ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG}"
else
    echo -e "\n${RED}❌ Failed to build and push images${NC}"
    exit 1
fi

# Step 4: Push architecture-specific tags for each platform
echo -e "\n${GREEN}Step 4: Pushing architecture-specific tags${NC}"

for platform in "${PLATFORM_ARRAY[@]}"; do
    # Extract architecture from platform (e.g., linux/amd64 -> amd64)
    arch=$(echo $platform | cut -d'/' -f2)
    
    echo "Building and pushing ${arch} specific image..."
    docker buildx build \
        --platform ${platform} \
        --tag ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG}-${arch} \
        --push \
        .
done

# Step 5: Verify the pushed images
echo -e "\n${GREEN}Step 5: Verifying pushed images${NC}"
echo "Inspecting manifest for multi-arch support:"
docker buildx imagetools inspect ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG}

echo -e "\n${GREEN}Available tags:${NC}"
echo -e "  - Multi-arch: ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG}"

echo -e "\n${GREEN}Architecture-specific tags:${NC}"
for platform in "${PLATFORM_ARRAY[@]}"; do
    arch=$(echo $platform | cut -d'/' -f2)
    echo -e "  - ${arch}: ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG}-${arch}"
done

echo -e "\n${GREEN}🎉 Build and push completed successfully!${NC}"
echo -e "${YELLOW}Usage examples:${NC}"
echo -e "  - Multi-arch: ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG}"
for platform in "${PLATFORM_ARRAY[@]}"; do
    arch=$(echo $platform | cut -d'/' -f2)
    echo -e "  - ${arch} only: ${ECR_REGISTRY}/${IMAGE_NAME}:${TAG}-${arch}"
done