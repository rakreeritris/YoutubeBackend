import { Router } from "express";
import { registerUser,loginUser, logoutUser, refreshAccessToken, updateAccountDetails, updateUserAvatar, changePassword, getCurrentUser, getUserChannelProfile, getWatchHistory } from "../controllers/user.controller.js";
import {upload} from '../middlewares/multer.middleware.js';
import { verifyJwt } from "../middlewares/auth.middleware.js";
const router=Router();

router.route('/register').post(upload.fields([
    {
        name:"avatar",
        maxCount:1,
    },
    {
        name:"coverImage",
        maxCount:1,
    }
]) ,registerUser);

router.route('/login').post(loginUser);
router.route('/refresh').post(refreshAccessToken);
//sercure routes
router.route('/updateDetails').post(verifyJwt,updateAccountDetails);
router.route('/updateAvatar').post(verifyJwt,upload.fields([
    {
        name:'avatar',
        maxCount:1,
    }
]),updateUserAvatar);
router.route('/change-password').post(verifyJwt,changePassword);
router.route('/get-user-details').post(verifyJwt,getCurrentUser);
router.route('/channel/:userName').post(verifyJwt,getUserChannelProfile);
router.route('/getWatchHistory').get(verifyJwt,getWatchHistory);
router.route('/logout').post(verifyJwt,logoutUser)

export default router;