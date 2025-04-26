import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs'
dotenv.config();
  // Configuration
  
  cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key:process.env.CLOUDINARY_API_KEY, 
    api_secret:process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
});

const uploadOnCloudinary=async(localFilePath)=>{
   try {
      if(!localFilePath)
        return null;
      const response = await cloudinary.uploader
      .upload(
          localFilePath, {
              public_id: 'shoes',
          }
      )
      fs.unlinkSync(localFilePath);
      return response;
   } catch (error) {
    fs.unlinkSync(localFilePath);
   }
}

export {uploadOnCloudinary}