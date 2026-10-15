import io
import os
from abc import ABC, abstractmethod
from typing import Generator, Optional, Tuple
from app.core.config import settings


class BaseStorageService(ABC):
    @abstractmethod
    def save_file(self, filename: str, content: bytes, content_type: str) -> None:
        """Store bytes securely under filename."""
        pass

    @abstractmethod
    def get_file_stream(self, filename: str) -> Tuple[Generator[bytes, None, None], str]:
        """Return (stream_generator, content_type) for chunked binary streaming."""
        pass

    @abstractmethod
    def file_exists(self, filename: str) -> bool:
        """Check if file exists in the storage backend."""
        pass

    @abstractmethod
    def delete_file(self, filename: str) -> bool:
        """Delete file if it exists. Returns True if deleted."""
        pass


class LocalStorageService(BaseStorageService):
    """Local disk storage for development and offline testing."""

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = os.path.abspath(base_dir or settings.EVIDENCE_STORAGE_DIR)
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_safe_path(self, filename: str) -> str:
        clean_filename = os.path.basename(filename)
        safe_path = os.path.abspath(os.path.join(self.base_dir, clean_filename))
        if not safe_path.startswith(self.base_dir):
            raise ValueError("Path traversal attempt detected.")
        return safe_path

    def save_file(self, filename: str, content: bytes, content_type: str) -> None:
        safe_path = self._get_safe_path(filename)
        with open(safe_path, "wb") as f:
            f.write(content)

    def get_file_stream(self, filename: str) -> Tuple[Generator[bytes, None, None], str]:
        safe_path = self._get_safe_path(filename)
        if not os.path.exists(safe_path) or not os.path.isfile(safe_path):
            raise FileNotFoundError(f"File {filename} not found.")

        ext = os.path.splitext(filename)[1].lower()
        media_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }
        content_type = media_types.get(ext, "application/octet-stream")

        def stream_generator():
            with open(safe_path, "rb") as f:
                while True:
                    chunk = f.read(64 * 1024)
                    if not chunk:
                        break
                    yield chunk

        return stream_generator(), content_type

    def file_exists(self, filename: str) -> bool:
        try:
            safe_path = self._get_safe_path(filename)
            return os.path.exists(safe_path) and os.path.isfile(safe_path)
        except ValueError:
            return False

    def delete_file(self, filename: str) -> bool:
        try:
            safe_path = self._get_safe_path(filename)
            if os.path.exists(safe_path) and os.path.isfile(safe_path):
                os.remove(safe_path)
                return True
            return False
        except Exception:
            return False


class S3StorageService(BaseStorageService):
    """
    Private S3-compatible object storage (Cloudflare R2, Supabase Storage, AWS S3).
    All objects are stored privately; downloads are never served via public/presigned URLs,
    only streamed through authorized backend endpoints.
    """

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        bucket_name: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        region_name: Optional[str] = None,
        s3_client=None,
    ):
        self.endpoint_url = endpoint_url or settings.S3_ENDPOINT_URL
        self.bucket_name = bucket_name or settings.S3_BUCKET_NAME
        self.access_key_id = access_key_id or settings.S3_ACCESS_KEY_ID
        self.secret_access_key = secret_access_key or settings.S3_SECRET_ACCESS_KEY
        self.region_name = region_name or settings.S3_REGION_NAME or "auto"

        if s3_client is not None:
            self.s3_client = s3_client
        else:
            import boto3
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                region_name=self.region_name,
            )

    def save_file(self, filename: str, content: bytes, content_type: str) -> None:
        clean_filename = os.path.basename(filename)
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=clean_filename,
            Body=content,
            ContentType=content_type,
        )

    def get_file_stream(self, filename: str) -> Tuple[Generator[bytes, None, None], str]:
        clean_filename = os.path.basename(filename)
        try:
            obj = self.s3_client.get_object(Bucket=self.bucket_name, Key=clean_filename)
        except Exception as e:
            raise FileNotFoundError(f"File {filename} not found in S3 bucket.") from e

        content_type = obj.get("ContentType", "application/octet-stream")
        body = obj["Body"]

        def stream_generator():
            while True:
                chunk = body.read(64 * 1024)
                if not chunk:
                    break
                yield chunk

        return stream_generator(), content_type

    def file_exists(self, filename: str) -> bool:
        clean_filename = os.path.basename(filename)
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=clean_filename)
            return True
        except Exception:
            return False

    def delete_file(self, filename: str) -> bool:
        clean_filename = os.path.basename(filename)
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=clean_filename)
            return True
        except Exception:
            return False


def get_storage_service() -> BaseStorageService:
    """Factory providing storage service based on application configuration."""
    backend = getattr(settings, "STORAGE_BACKEND", "local").lower()
    if backend == "s3":
        return S3StorageService()
    return LocalStorageService()
