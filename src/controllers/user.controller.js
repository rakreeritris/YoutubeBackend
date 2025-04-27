import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
const generateAccessAndRefreshToken=async(userId)=>{
    try {
        const user=await User.findById(userId);
        const accessToken=user.generateAccessToken();
        const refreshToken=user.generateRefreshToken();

        user.refreshToken=refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken,refreshToken};
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token");
    }
}
const registerUser=asyncHandler(
    async(req,res)=>{
      const {userName,email,fullName,password}=req.body;
      console.log(req.body);
      if([userName,email,fullName,password].some((field)=>field?.trim()===""))
      {
        throw new ApiError(400,"All fields are required");
      }
        const existedUser=await User.findOne(
            {
                $or:[{userName},{email}]
            }
        )
        if(existedUser)
        {
            throw new ApiError(409,"user with email or username already exist")
        }
        const avatarLocalPath=req?.files?.avatar[0]?.path;
        const coverImageLocalPath=req?.files?.coverImage?.[0]?.path;
        if(!avatarLocalPath)
        {
            throw new ApiError(400,'Avatar file is required');
        }
        const avatar=await uploadOnCloudinary(avatarLocalPath);

      let coverImage = { url: "" };
if (coverImageLocalPath) {
    console.log('coverImageLocalPagth',coverImageLocalPath);
  coverImage = await uploadOnCloudinary(coverImageLocalPath);
}
        const user=await User.create({
            userName,
            email,
            fullName,
            avatar:avatar.url,
            coverImage:coverImage?.url??"",
            password
        })
        const createdUser=await User.findById(user._id).select("-password -refreshToken");
        if(!createdUser)
        {
            throw new ApiError(500,"Something went wrong while registering user");
        }
      res.status(200).json(new ApiResponse(201,createdUser,"user created successfully"));
    }
)
const loginUser=asyncHandler(async(req,res)=>{
    const {userName,email,password}=req.body;

    if(!userName&& !email)
    {
        throw new ApiError(400,"username email or password is required");
    }
    if(!password)
    {
        throw new Error(400,"password is required");
    }

    const existedUser= await User.findOne({
        $or:[{userName},{email}]
    })
    if(!existedUser)
    {
        throw new ApiError(404,"Invalid login user does not exist")
    }
    const ispasswordMatch=await existedUser.isPasswordCorrect(password);

    if(!ispasswordMatch)
    {
        throw new ApiError(401,"Password does not match");
    }

   const {accessToken,refreshToken}= await generateAccessAndRefreshToken(existedUser._id);

   const loggedInUser=await User.findById(existedUser._id).select("-password -refreshToken");
   const options={
    httpOnly:true,
    secure:true
   }
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(new ApiResponse(200,{
    user:loggedInUser,
    accessToken,
    refreshToken
   },"User logged in successfully"));

});
const logoutUser=asyncHandler(async(req,res)=>{
    const options={
        httpOnly:true,
        secure:true
       }
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshToken: undefined } },
        {new:true}
      );

      return res
      .status(200)
      .clearCookie("accessToken",options)
      .clearCookie("refreshToken",options)
      .json(new ApiResponse(200,{},"User logged out successfully"));
});

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken||req.body.refreshToken;
    if(!incomingRefreshToken)
    {
        throw new ApiError(401,"unauthorized request");
    }
       const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
       const user =await User.findById(decodedToken._id);
       if(!user)
       {
        throw new ApiError(401,'Invalid refresh token');
       }
       if(incomingRefreshToken!==user?.refreshToken)
       {
        throw new ApiError(401,'Refresh token is expired or used')
       }
       const options={
        httpOnly:true,
        secure:true,
       }
       const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id);
       return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(new ApiResponse(200,{
    accessToken,
    refreshToken
   },"Access Token refreshed"));
})
export {registerUser,loginUser,logoutUser,refreshAccessToken};