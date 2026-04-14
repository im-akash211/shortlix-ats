import hashlib

_CHUNK_SIZE = 8192


def generate_file_hash(file_obj) -> str:
    """
    Return the SHA-256 hex digest of file_obj's contents.

    Reads the file in chunks so large files are handled safely.
    Resets the stream pointer to 0 both before reading and after,
    so the file remains fully usable for S3 upload, DB save, and parsing.
    """
    hasher = hashlib.sha256()
    file_obj.seek(0)
    while chunk := file_obj.read(_CHUNK_SIZE):
        hasher.update(chunk)
    file_obj.seek(0)
    return hasher.hexdigest()
