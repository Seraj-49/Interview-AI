import User from "../models/usermodel.js";
import Interview from "../models/interview.model.js";

export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId
        const user = await User.findById(userId)
        if(!user) {
            return res.status(404).json({message:"user does not found"})
        }
        return res.status(200).json(user)
    } catch (error) {
        return res.status(500).json({message:`failed to get currentUser ${error}`})
    }
}

export const getInterviewHistory = async (req, res) => {
    try {
        const interviews = await Interview.find({ userId: req.userId, status: "completed" })
            .select("role experience mode finalScore createdAt questions")
            .sort({ createdAt: -1 });
        return res.status(200).json(interviews.map((interview) => ({
            id: interview._id,
            role: interview.role,
            experience: interview.experience,
            mode: interview.mode,
            finalScore: Number((interview.finalScore || 0).toFixed(1)),
            questionCount: interview.questions.length,
            createdAt: interview.createdAt,
        })));
    } catch (error) {
        return res.status(500).json({ message: `failed to get interview history ${error}` });
    }
};

export const deleteInterviewHistory = async (req, res) => {
    try {
        const deleted = await Interview.findOneAndDelete({ _id: req.params.interviewId, userId: req.userId });
        if (!deleted) return res.status(404).json({ message: "Interview not found." });
        return res.status(200).json({ message: "Interview deleted successfully." });
    } catch (error) {
        return res.status(500).json({ message: `failed to delete interview ${error}` });
    }
};

export const getDashboardStats = async (req, res) => {
    try {
        const interviews = await Interview.find({ userId: req.userId, status: "completed" })
            .select("role mode finalScore createdAt report")
            .sort({ createdAt: -1 })
            .limit(8);
        const total = await Interview.countDocuments({ userId: req.userId, status: "completed" });
        const averageScore = interviews.length ? interviews.reduce((sum, item) => sum + (item.finalScore || 0), 0) / interviews.length : 0;
        const weakAreas = [...new Set(interviews.flatMap((item) => item.report?.weaknesses || []))].slice(0, 3);
        const recommendedTopic = interviews.flatMap((item) => item.report?.recommendedTopics || [])[0] || "Complete an interview to receive a personalized recommendation.";
        return res.status(200).json({ total, averageScore: Number(averageScore.toFixed(1)), weakAreas, recommendedTopic, recent: interviews.slice(0, 3) });
    } catch (error) { return res.status(500).json({ message: `failed to get dashboard stats ${error}` }); }
};
