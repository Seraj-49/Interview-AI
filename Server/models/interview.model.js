import mongoose from "mongoose"

const questionsSchema = new mongoose.Schema({
    question: String,
    difficulty: String,
    timeLimit: Number,
    answer: String,
    feedback: String,
    score: { type:Number, default: 0 },
    confidence: { type: Number, default: 0},
    communication: { type: Number, default: 0 },
    correctness: { type: Number, default: 0 },
    relevance: { type: Number, default: 0 },
    structure: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    isFollowUp: { type: Boolean, default: false },
    isBookmarked: { type: Boolean, default: false },
    parentQuestionId: { type: mongoose.Schema.Types.ObjectId, default: null },
})

const interviewSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    role:{
        type:String,
        required:true
    },
    experience:{
        type:String,
        required:true
    },
    mode:{
        type:String,
        enum:["Technical", "HR", "Frontend Developer", "Backend Developer", "Full Stack Developer", "System Design", "Mixed"],
        required:true
    },
    resumeText:{
        type:String
    },
    jobDescription: { type: String, default: "" },
    difficultyLevel: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Intermediate" },
    interviewerStyle: { type: String, enum: ["Professional", "Friendly", "Challenging"], default: "Professional" },
    adaptiveMode: { type: Boolean, default: true },
    creditChargeId: { type: String, unique: true, sparse: true },
    creditCost: { type: Number, default: 50 },
    questions:[questionsSchema],

    finalScore: { type: Number, default: 0 },
    report: {
        strengths: { type: [String], default: [] },
        weaknesses: { type: [String], default: [] },
        improvements: { type: [String], default: [] },
        recommendedTopics: { type: [String], default: [] },
        missingConcepts: { type: [String], default: [] },
        roadmap: { type: [String], default: [] },
        skillCoverage: { type: [String], default: [] },
    },

    status: {
        type: String,
        enum: ["Incompleted", "completed"],
        default: "Incompleted",
    }

},{timestamps:true})

const Interview = mongoose.model("Interview", interviewSchema)

export default Interview
