"""
Encryption Utility
Used for encrypting/decrypting user credentials for integrations
"""
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv, find_dotenv
import json
import logging

load_dotenv(find_dotenv(usecwd=False))
logger = logging.getLogger(__name__)


class EncryptionService:
    """Service for encrypting and decrypting sensitive data"""
    
    def __init__(self):
        # Get encryption key from environment
        key = os.getenv('ENCRYPTION_KEY')
        
        if not key:
            logger.warning("ENCRYPTION_KEY not set in environment, generating new key")
            key = Fernet.generate_key().decode()
            logger.warning(f"Generated key: {key}")
            logger.warning("Add this to your .env file as ENCRYPTION_KEY")
        
        if isinstance(key, str):
            key = key.encode()
        
        self.fernet = Fernet(key)
    
    def encrypt_dict(self, data: dict) -> str:
        """
        Encrypt a dictionary to a string
        
        Args:
            data: Dictionary to encrypt
            
        Returns:
            Encrypted string
        """
        try:
            # Convert dict to JSON string
            json_str = json.dumps(data)
            
            # Encrypt
            encrypted = self.fernet.encrypt(json_str.encode())
            
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Encryption error: {e}")
            raise
    
    def decrypt_dict(self, encrypted_data: str) -> dict:
        """
        Decrypt a string to a dictionary
        
        Args:
            encrypted_data: Encrypted string
            
        Returns:
            Decrypted dictionary
        """
        try:
            # Decrypt
            decrypted = self.fernet.decrypt(encrypted_data.encode())
            
            # Convert JSON string to dict
            data = json.loads(decrypted.decode())
            
            return data
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            raise


def generate_encryption_key() -> str:
    """Generate a new encryption key"""
    return Fernet.generate_key().decode()


if __name__ == '__main__':
    # Generate a new encryption key
    print("Generated Encryption Key:")
    print(generate_encryption_key())
    print("\nAdd this to your .env file as ENCRYPTION_KEY")
