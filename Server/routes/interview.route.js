import express from "express"
import isAuth from '../middlewares/isAuth.js'
import { upload } from "../middlewares/multer.js"
import { analyzeResume, finishInterview, getQuestionAudio, generateQuestion, getInterviewReport, submitAnswer, toggleQuestionBookmark } from "../controllers/interview.controller.js"



const interviewRouter = express.Router()

interviewRouter.post("/resume",isAuth,upload.single("resume"),analyzeResume)
interviewRouter.post("/generate-questions",isAuth,generateQuestion)
interviewRouter.post("/submit-answer",isAuth,submitAnswer)
interviewRouter.post("/finish",isAuth,finishInterview)
interviewRouter.patch("/:interviewId/questions/:questionId/bookmark",isAuth,toggleQuestionBookmark)
interviewRouter.get("/:interviewId/questions/:questionId/audio",isAuth,getQuestionAudio)
interviewRouter.get("/:interviewId",isAuth,getInterviewReport)




export default interviewRouter
