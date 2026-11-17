import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { deleteInterviewHistory, getCurrentUser, getDashboardStats, getInterviewHistory } from "../controllers/user.controller.js"


const userRouter = express.Router()

userRouter.get("/current-user",isAuth,getCurrentUser)
userRouter.get("/interviews",isAuth,getInterviewHistory)
userRouter.get("/dashboard",isAuth,getDashboardStats)
userRouter.delete("/interviews/:interviewId",isAuth,deleteInterviewHistory)

export default userRouter
