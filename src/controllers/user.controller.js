import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
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

const changePassword=asyncHandler(async(req,res)=>{
   const {oldPassword,newPassword}=req.body;

   if(!oldPassword||!newPassword)
   {
    throw new ApiError(400,"All fields are required");
   }
   const user=await User.findById(req?.user?._id);

   const isPasswordMatch=await user.isPasswordCorrect(oldPassword);
   if(!isPasswordMatch)
   {
    throw new ApiError(401,'Old password is incorrect');
   }
   user.password=newPassword;
   await user.save({validateBeforeSave:false})
   res.status(200).json(new ApiResponse(200,'Password changed successfully'));
}); 

const getCurrentUser=asyncHandler(async(req,res)=>{
    res
    .status(200)
    .json(new ApiResponse(200,req.user,"Current user fetched successfully"))
});

const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullName,email}=req.body;
    if(!fullName||!email)
    {
        throw new ApiError(400,"All fields are required")
    }
    const user=await User.findByIdAndUpdate(req.user._id,{
        $set:{
            fullName,
            email,
        },
    },{new:true}).select('-password');
    res
    .status(200)
    .json(new ApiResponse(200,user,'User details updated successfully'));
});

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.files?.avatar?.[0].path;
    if(!avatarLocalPath)
    {
        throw new ApiError(400,"Avatar file is missing");
    };

    const avatar=await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url)
    {
        throw new ApiError(400,'Error while uploading the file');
    }

    await User.findByIdAndUpdate(req.user._id,{
        $set:{
            avatar:avatar.url
        }
    }).select("-password");

    res
    .status(200)
    .json(new ApiResponse(200,{},'Avatar of user updated successfully'));
})
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

const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {userName}=req.params;
    if(!userName?.trim())
    {
        throw new ApiError(400,"userName is not present");
    }
   const channel=await  User.aggregate([{
      $match:{
        userName:userName
      }
    },{
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
        }
    },{
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subscribedTo"
        }
    },{
        $addFields:{
            subscribersCount:{
                $size:"$subscribers"
            },
            channelsSubscribedTo:{
                $size:"$subscribedTo"
            },
            isSubscribed:{
                $cond:{
                    if:{$in:[req.user?._id,"$subscribers"]},
                    then:true,
                    else:false
                }
            }
        }
    },{
        $project:{
            fullName:1,
            userName:1,
            subscribersCount:1,
            channelsSubscribedTo:1,
            isSubscribed:1
        }
    }]);

    if(!channel?.length)
    {
        throw new ApiError(404,"Channel does not exist");

    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channels details fetched successfully")
    )
});

const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        userName:1,
                                        avatar:1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]);
    res.status(200)
    .json(new ApiResponse(
        200,
        user[0].watchHistory,
        "watchHistory fetched successfully"
    ))
})
export {registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    getUserChannelProfile,
    getWatchHistory
};