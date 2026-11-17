import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openRouter.service.js";
import User from "../models/usermodel.js";
import Interview from "../models/interview.model.js";
import { getInterviewCost, INTERVIEW_MODES } from "../config/interviewModes.js";
import { generateQuestionAudio } from "../services/tts.service.js";

const parseAiJson = (content) => {
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end < start) throw new Error("AI returned invalid JSON.");
    return JSON.parse(cleaned.slice(start, end + 1));
};

const score = (value) => Math.max(0, Math.min(10, Number(value) || 0));


// ==================== ANALYZE RESUME ====================

export const analyzeResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Resume required"
            });
        }

        const filepath = req.file.path;

        const fileBuffer = await fs.promises.readFile(filepath);
        const uint8Array = new Uint8Array(fileBuffer);

        const pdf = await pdfjsLib.getDocument({
            data: uint8Array
        }).promise;

        let resumeText = "";

        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();

            const pageText = content.items
                .map(item => item.str)
                .join(" ");

            resumeText += pageText + "\n";
        }

        resumeText = resumeText
            .replace(/\s+/g, " ")
            .trim();

        const messages = [
            {
                role: "system",
                content: `
                Extract structured data from resume.

                Return strictly JSON:

                {
                    "role": "string",
                    "experience": "string",
                    "projects": ["project1", "project2"],
                    "skills": ["skill1", "skill2"]
                }
                `
            },
            {
                role: "user",
                content: resumeText
            }
        ];

        const aiResponse = await askAi(messages);

      let cleanedResponse = aiResponse
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

      const startIndex = cleanedResponse.indexOf("{");
     const endIndex = cleanedResponse.lastIndexOf("}");

       if (startIndex === -1 || endIndex === -1) {
       throw new Error("AI did not return valid JSON.");
}

cleanedResponse = cleanedResponse.substring(
    startIndex,
    endIndex + 1
);

const parsed = JSON.parse(cleanedResponse);

        await fs.promises.unlink(filepath);

        res.json({
            role: parsed.role,
            experience: parsed.experience,
            projects: parsed.projects,
            skills: parsed.skills,
            resumeText
        });

    } catch (error) {

        console.log(error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
            message: error.message
        });
    }
};


// ==================== GENERATE QUESTION ====================

export const generateQuestion = async (req, res) => {
    let chargedCost = 0;
    let chargedRequestId = null;
    try {

    
        let {
            role,
            experience,
            mode,
            resumeText,
            projects,
            skills,
            requestId,
            jobDescription,
            difficultyLevel = "Intermediate",
            interviewerStyle = "Professional",
            adaptiveMode = true
        } = req.body;

        role = role?.trim();
        experience = experience?.trim();
        mode = mode?.trim();

        if (!role || !experience || !mode) {
            return res.status(400).json({
                message: "Role, Experience and Mode are required."
            });
        }
        if (!INTERVIEW_MODES[mode]) {
            return res.status(400).json({ message: "Unsupported interview mode." });
        }
        if (!["Beginner", "Intermediate", "Advanced"].includes(difficultyLevel) || !["Professional", "Friendly", "Challenging"].includes(interviewerStyle)) {
            return res.status(400).json({ message: "Invalid interview difficulty or interviewer style." });
        }
        const creditCost = getInterviewCost(mode);

        let user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (user.credits < creditCost) {
            return res.status(400).json({
                message: `Not enough credits. ${creditCost} credits are required for this interview.`,
                requiredCredits: creditCost
            });
        }

        if (requestId) {
            const existingInterview = await Interview.findOne({ userId: req.userId, creditChargeId: requestId });
            if (existingInterview) {
                return res.json({ interviewId: existingInterview._id, creditsLeft: user.credits, userName: user.name, role: existingInterview.role, experience: existingInterview.experience, mode: existingInterview.mode, questions: existingInterview.questions });
            }
        }

        const projectText =
            Array.isArray(projects) && projects.length
                ? projects.join(", ")
                : "None";

        const skillsText =
            Array.isArray(skills) && skills.length
                ? skills.join(", ")
                : "None";

        const safeResume = resumeText?.trim() || "None";

        const userPrompt = `
        Role:${role}
        Experience:${experience}
        InterviewMode:${mode}
        Mode focus:${INTERVIEW_MODES[mode]}
        projects:${projectText}
        skills:${skillsText}
        Resume:${safeResume}
        JobDescription:${String(jobDescription || "").trim() || "None provided"}
        Difficulty:${difficultyLevel}
        InterviewerStyle:${interviewerStyle}
        AdaptiveMode:${adaptiveMode ? "enabled" : "disabled"}`;

        if (!userPrompt.trim()) {
            return res.status(400).json({
                message: "Prompt content is empty."
            });
        }


        // ==================== GENERATE QUESTION PROMPT ====================

        const messages = [
            {
                role: "system",
                content: `
                You are a real human interviewer conducting a professional interview.

                Speak in simple, natural English as if you are directly talking to the candidate.

                Generate exactly 5 interview questions.

                Strict Rules:
                - Each question must contain between 15 and 25 words.
                - Each question must be a single complete sentence.
                - Do NOT number them.
                - Do NOT add explanations.
                - Do NOT add extra text before or after.
                - One question per line only.
                - Keep language simple and conversational.
                - Questions must feel practical and realistic.

                Difficulty progression:
                Question 1 → easy
                Question 2 → easy
                Question 3 → medium
                Question 4 → medium
                Question 5 → hard

                Generate questions at the requested ${difficultyLevel} level and keep the interviewer ${interviewerStyle.toLowerCase()}.

                Make questions based on the candidate’s role, experience, selected mode,
                projects, skills, and resume details. The mode focus is mandatory.
                `
            },
            {
                role: "user",
                content: userPrompt
            }
        ];

        const aiResponse = await askAi(messages);

        if (!aiResponse || !aiResponse.trim()) {
            return res.status(500).json({
                message: "AI returned empty response."
            });
        }

        const questionArray = aiResponse
            .split("\n")
            .map(q => q.replace(/^\s*\d+[.)]\s*/, "").trim())
            .filter(q => q.length > 0)
            .slice(0, 5);


        // FIX 2: questionsArray -> questionArray
        if (questionArray.length === 0) {
            return res.status(500).json({
                message: "AI failed to generate questions."
            });
        }

        if (requestId) {
            user = await User.findOneAndUpdate(
                { _id: req.userId, credits: { $gte: creditCost }, processedInterviewRequests: { $ne: requestId } },
                { $inc: { credits: -creditCost }, $addToSet: { processedInterviewRequests: requestId } },
                { new: true }
            );
            if (!user) {
                const existingInterview = await Interview.findOne({ userId: req.userId, creditChargeId: requestId });
                if (existingInterview) return res.json({ interviewId: existingInterview._id, creditsLeft: (await User.findById(req.userId)).credits, userName: user.name, role: existingInterview.role, experience: existingInterview.experience, mode: existingInterview.mode, questions: existingInterview.questions });
                return res.status(409).json({ message: "This interview request is already being processed." });
            }
            chargedCost = creditCost;
            chargedRequestId = requestId;
        } else {
            user.credits -= creditCost;
            await user.save();
            chargedCost = creditCost;
        }

        const interview = await Interview.create({
            userId: user._id,
            role,
            experience,
            mode,
            resumeText: safeResume,
            jobDescription: String(jobDescription || "").trim(),
            difficultyLevel,
            interviewerStyle,
            adaptiveMode: Boolean(adaptiveMode),
            creditChargeId: requestId || undefined,
            creditCost,

            questions: questionArray.map((q, index) => ({
                question: q,
                difficulty: [
                    "easy",
                    "easy",
                    "medium",
                    "medium",
                    "hard"
                ][index],

                timeLimit: [
                    60,
                    60,
                    90,
                    90,
                    120
                ][index]
            }))
        });
        chargedCost = 0;

        res.json({
            interviewId: interview._id,
            creditsLeft: user.credits,
            userName: user.name,
            role,
            experience,
            mode,
            difficultyLevel,
            interviewerStyle,
            adaptiveMode: Boolean(adaptiveMode),
            questions: interview.questions
        });

    } catch (error) {
        if (chargedCost) {
            const rollback = chargedRequestId
                ? { $inc: { credits: chargedCost }, $pull: { processedInterviewRequests: chargedRequestId } }
                : { $inc: { credits: chargedCost } };
            await User.findByIdAndUpdate(req.userId, rollback);
        }

        return res.status(500).json({
            message: `failed to create interview due to ${error}`
        });
    }
};


// ==================== SUBMIT ANSWER ====================

export const submitAnswer = async (req, res) => {
    try {

        const {
            interviewId,
            questionIndex,
            answer,
            timeTaken
        } = req.body;

        const interview = await Interview.findOne({ _id: interviewId, userId: req.userId });

        if (!interview) {
            return res.status(404).json({
                message: "Interview not found."
            });
        }


        const question = interview.questions[questionIndex];


        if (!question) {
            return res.status(400).json({
                message: "Question not found."
            });
        }

        if (typeof question.answer === "string") {
            return res.status(409).json({ message: "This question has already been submitted." });
        }


        // If no answer
        if (!answer) {

            question.score = 0;
            question.confidence = 0;
            question.communication = 0;
            question.correctness = 0;

            question.feedback = "You did not submit an answer";
            question.answer = "";

            await interview.save();

            return res.json({
                feedback: question.feedback
            });
        }


        // If time exceeded
        if (timeTaken > question.timeLimit) {

            question.score = 0;
            question.confidence = 0;
            question.communication = 0;
            question.correctness = 0;

            question.feedback =
                "Time limit exceeded. Answer not evaluated";

            question.answer = answer;

            await interview.save();

            return res.json({
                feedback: question.feedback
            });
        }


        // ==================== AI EVALUATION ====================

        const messages = [
            {
                role: "system",
                content: `
                You are a professional human interviewer evaluating a candidate's answer in a real interview.

                Evaluate naturally and fairly, like a real person would.
                The interview mode is ${interview.mode}. Evaluate against this mode focus: ${INTERVIEW_MODES[interview.mode] || "role-relevant interview skills"}.

                Score the answer in these areas (0 to 10):

                1. Confidence – Does the answer sound clear, confident, and well-presented?
                2. Communication – Is the language simple, clear, and easy to understand?
                3. Correctness – Is the answer technically accurate and complete?
                4. Relevance – Does the answer directly address the question?
                5. Structure – Is the answer logically organised with a clear flow?
                6. Problem-solving – Does the answer demonstrate sound reasoning and trade-offs?

                Rules:
                - Be realistic and unbiased.
                - Do not give random high scores.
                - If the answer is weak, score low.
                - If the answer is strong and detailed, score high.
                - Consider clarity, structure, and relevance.

                Calculate:
                finalScore = average of all six scores (rounded to one decimal place).

                Feedback Rules:
                - Write natural human feedback.
                - 10 to 15 words only.
                - Sound like real interview feedback.
                - Can suggest improvement if needed.
                - Do NOT repeat the question.
                - Do NOT explain scoring.
                - Keep tone professional and honest.

                Return ONLY valid JSON in this format:

                {
                    "confidence": number,
                    "communication": number,
                    "correctness": number,
                    "relevance": number,
                    "structure": number,
                    "problemSolving": number,
                    "finalScore": number,
                    "feedback": "short human feedback"
                }
                `
            },
            {
                role: "user",
                content: `
                Question: ${question.question}
                Answer: ${answer}
                `
            }
        ];


        const aiResponse = await askAi(messages);

        const parsed = parseAiJson(aiResponse);

        question.answer = answer;

        question.confidence = score(parsed.confidence);
        question.communication = score(parsed.communication);
        question.correctness = score(parsed.correctness);
        question.relevance = score(parsed.relevance);
        question.structure = score(parsed.structure);
        question.problemSolving = score(parsed.problemSolving);
        question.score = score(parsed.finalScore);

        question.feedback = parsed.feedback;

        let followUpQuestion = null;
        const followUpCount = interview.questions.filter((item) => item.isFollowUp).length;
        if (interview.adaptiveMode !== false && followUpCount < 2 && questionIndex < 5) {
            try {
                const followUpResponse = await askAi([
                    { role: "system", content: `You are a ${(interview.interviewerStyle || "Professional").toLowerCase()} adaptive interviewer. Return only one concise follow-up question (maximum 25 words). For strong answers, deepen the technical challenge; for weak answers, clarify a missing concept. Keep it relevant and never repeat an existing question.` },
                    { role: "user", content: `Role: ${interview.role}\nMode: ${interview.mode}\nDifficulty: ${interview.difficultyLevel || "Intermediate"}\nScore: ${question.score}/10\nQuestion: ${question.question}\nAnswer: ${answer}\nExisting questions: ${interview.questions.map((item) => item.question).join(" | ")}` }
                ]);
                const text = followUpResponse.replace(/```/g, "").trim().split("\n")[0].replace(/^\s*\d+[.)]\s*/, "").trim();
                if (text && text.endsWith("?") && !interview.questions.some((item) => item.question.toLowerCase() === text.toLowerCase())) {
                    const followUp = { question: text, difficulty: question.difficulty, timeLimit: 60, isFollowUp: true, parentQuestionId: question._id };
                    interview.questions.push(followUp);
                    followUpQuestion = interview.questions[interview.questions.length - 1];
                }
            } catch (followUpError) {
                console.error("Follow-up generation error:", followUpError.message);
            }
        }

        await interview.save();

        return res.status(200).json({
            feedback: parsed.feedback,
            scores: { confidence: question.confidence, communication: question.communication, correctness: question.correctness, relevance: question.relevance, structure: question.structure, problemSolving: question.problemSolving },
            followUpQuestion
        });


    } catch (error) {

        return res.status(500).json({
            message: `failed to submit answer due to ${error}`
        });
    }
};


// ==================== FINISH INTERVIEW ====================

export const finishInterview = async (req, res) => {
    try {

        const { interviewId } = req.body;

        const interview = await Interview.findOne({ _id: interviewId, userId: req.userId });

        if (!interview) {
            return res.status(400).json({
                message: "failed to find Interview"
            });
        }

        const totalQuestions = interview.questions.length;

        let totalScore = 0;
        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalCorrectness = 0;
        let totalRelevance = 0;
        let totalStructure = 0;
        let totalProblemSolving = 0;


        interview.questions.forEach((q) => {

            totalScore += q.score || 0;

            totalConfidence += q.confidence || 0;

            totalCommunication += q.communication || 0;

            totalCorrectness += q.correctness || 0;
            totalRelevance += q.relevance || 0;
            totalStructure += q.structure || 0;
            totalProblemSolving += q.problemSolving || 0;

        });


        const finalScore =
            totalQuestions
                ? totalScore / totalQuestions
                : 0;


        const avgConfidence =
            totalQuestions
                ? totalConfidence / totalQuestions
                : 0;


        const avgCommunication =
            totalQuestions
                ? totalCommunication / totalQuestions
                : 0;


        const avgCorrectness =
            totalQuestions
                ? totalCorrectness / totalQuestions
                : 0;

        const avgRelevance = totalQuestions ? totalRelevance / totalQuestions : 0;
        const avgStructure = totalQuestions ? totalStructure / totalQuestions : 0;
        const avgProblemSolving = totalQuestions ? totalProblemSolving / totalQuestions : 0;

        let report = { strengths: [], weaknesses: [], improvements: [], recommendedTopics: [], missingConcepts: [], roadmap: [], skillCoverage: [] };
        try {
            const reportResponse = await askAi([
                { role: "system", content: "Create a concise interview summary. Return ONLY JSON with arrays: strengths, weaknesses, improvements, recommendedTopics, missingConcepts, roadmap, skillCoverage. Each array must have 2-4 actionable short strings." },
                { role: "user", content: `Role: ${interview.role}\nMode: ${interview.mode}\nJob description: ${interview.jobDescription || "Not provided"}\nScores: confidence ${avgConfidence.toFixed(1)}, communication ${avgCommunication.toFixed(1)}, correctness ${avgCorrectness.toFixed(1)}, relevance ${avgRelevance.toFixed(1)}, structure ${avgStructure.toFixed(1)}, problem-solving ${avgProblemSolving.toFixed(1)}\nAnswers: ${interview.questions.map((q) => `Q: ${q.question} A: ${q.answer || "No answer"}`).join("\n")}` }
            ]);
            const parsedReport = parseAiJson(reportResponse);
            report = {
                strengths: Array.isArray(parsedReport.strengths) ? parsedReport.strengths : [],
                weaknesses: Array.isArray(parsedReport.weaknesses) ? parsedReport.weaknesses : [],
                improvements: Array.isArray(parsedReport.improvements) ? parsedReport.improvements : [],
                recommendedTopics: Array.isArray(parsedReport.recommendedTopics) ? parsedReport.recommendedTopics : [],
                missingConcepts: Array.isArray(parsedReport.missingConcepts) ? parsedReport.missingConcepts : [],
                roadmap: Array.isArray(parsedReport.roadmap) ? parsedReport.roadmap : [],
                skillCoverage: Array.isArray(parsedReport.skillCoverage) ? parsedReport.skillCoverage : [],
            };
        } catch (reportError) {
            console.error("Report generation error:", reportError.message);
        }


        interview.finalScore = finalScore;

        interview.status = "completed";
        interview.report = report;

        await interview.save();


        return res.status(200).json({

            finalScore:
                Number(finalScore.toFixed(1)),

            confidence:
                Number(avgConfidence.toFixed(1)),

            communication:
                Number(avgCommunication.toFixed(1)),

            correctness:
                Number(avgCorrectness.toFixed(1)),
            relevance: Number(avgRelevance.toFixed(1)),
            structure: Number(avgStructure.toFixed(1)),
            problemSolving: Number(avgProblemSolving.toFixed(1)),
            report,
            interviewId: interview._id,

            questionWiseScore:
                interview.questions.map((q) => ({

                    question: q.question,

                    score: q.score || 0,

                    feedback: q.feedback || "",

                    confidence:
                        q.confidence || 0,

                    communication:
                        q.communication || 0,

                    correctness:
                        q.correctness || 0,
                    relevance: q.relevance || 0,
                    structure: q.structure || 0,
                    problemSolving: q.problemSolving || 0,
                    isFollowUp: q.isFollowUp

                })),

        });


    } catch (error) {

        return res.status(500).json({
            message: `failed to finish Interview ${error}`
        });

    }
};

export const toggleQuestionBookmark = async (req, res) => {
    try {
        const interview = await Interview.findOne({ _id: req.params.interviewId, userId: req.userId });
        if (!interview) return res.status(404).json({ message: "Interview not found." });
        const question = interview.questions.id(req.params.questionId);
        if (!question) return res.status(404).json({ message: "Question not found." });
        question.isBookmarked = !question.isBookmarked;
        await interview.save();
        return res.status(200).json({ bookmarked: question.isBookmarked });
    } catch (error) { return res.status(500).json({ message: `Unable to update bookmark: ${error.message}` }); }
};

export const getQuestionAudio = async (req, res) => {
    try {
        const interview = await Interview.findOne({ _id: req.params.interviewId, userId: req.userId });
        if (!interview) return res.status(404).json({ message: "Interview not found." });
        const question = interview.questions.id(req.params.questionId);
        if (!question) return res.status(404).json({ message: "Question not found." });
        console.info("[TTS:ElevenLabs] question received", { interviewId: String(interview._id), questionId: String(question._id), textLength: question.question.length });
        const { audio, contentType } = await generateQuestionAudio({ text: question.question });
        console.info("[TTS:ElevenLabs] audio response ready", { byteLength: audio.length, contentType });
        res.set({ "Content-Type": contentType, "Content-Length": audio.length, "Cache-Control": "private, max-age=3600" });
        return res.status(200).send(audio);
    } catch (error) { return res.status(error.response?.status || error.status || 500).json({ message: error.response?.data?.error?.message || error.message || "Unable to generate question audio." }); }
};

export const getInterviewReport = async (req, res) => {
    try {
        const interview = await Interview.findOne({ _id: req.params.interviewId, userId: req.userId, status: "completed" });
        if (!interview) return res.status(404).json({ message: "Completed interview not found." });
        const questions = interview.questions;
        const average = (field) => questions.length ? questions.reduce((sum, question) => sum + (question[field] || 0), 0) / questions.length : 0;
        return res.status(200).json({
            interviewId: interview._id, role: interview.role, experience: interview.experience, mode: interview.mode,
            finalScore: Number((interview.finalScore || 0).toFixed(1)), confidence: Number(average("confidence").toFixed(1)), communication: Number(average("communication").toFixed(1)), correctness: Number(average("correctness").toFixed(1)), relevance: Number(average("relevance").toFixed(1)), structure: Number(average("structure").toFixed(1)), problemSolving: Number(average("problemSolving").toFixed(1)), report: interview.report,
            questionWiseScore: questions.map((question) => ({ question: question.question, score: question.score || 0, feedback: question.feedback || "", confidence: question.confidence || 0, communication: question.communication || 0, correctness: question.correctness || 0, relevance: question.relevance || 0, structure: question.structure || 0, problemSolving: question.problemSolving || 0, isFollowUp: question.isFollowUp }))
        });
    } catch (error) { return res.status(500).json({ message: `failed to get interview report ${error}` }); }
};


// import fs from "fs"
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
// import { askAi } from "../services/openRouter.service.js";
// import User from "../models/usermodel.js"

//  export const analyzeResume = async (req, res) => {
//     try {
//          if(!req.file){
//              return res.status(400).json({ message: "Resume required" });
//         }
//          const filepath = req.file.path

//          const fileBuffer = await fs.promises.readFile(filepath)
//         const uint8Array = new Uint8Array(fileBuffer)

//         const pdf = await pdfjsLib.getDocument({data:uint8Array}).promise;

//          let resumeText = "";

//          // Extract text from all pages
//          for(let pageNum = 1; pageNum <=pdf.numPages; pageNum++) {
//             const page = await pdf.getPage(pageNum);
//             const content = await page.getTextContent();

//              const pageText = content.items.map(item => item.str).join(" ");
//              resumeText += pageText + "\n";        
//             }

//          resumeText = resumeText
//             .replace(/\s+/g, " ")
//             .trim();

//             const messages = [
//              {
//                  role: "system",
//                  content:`
//                  Extract structured data from resume.
                
//                  Return strictly JSON:

//                  {
//                  "role": "string",
//                  "experience": "string",
//                  "projects": ["project1", "project2"],
//                  "skills": ["skill1", "skill2"]
//                  }
//                  `
//              },
//              {
//                  role: "user",
//                  content: resumeText
//              }
//             ];

//             const aiResponse = await askAi(messages)

//             const parsed = JSON.parse(aiResponse);

//             fs.unlinkSync(filepath)

//             res.json({
//              role: parsed.role,
//              experience: parsed.experience,
//              projects: parsed.projects,
//              skills: parsed.skills,
//              resumeText
//             });

//     } catch (error) {
//         console.log(error);

//       if(req.file && fs.existsSync(req.file.path)) {
//           fs.unlinkSync(req.file.path);
//        }

//         return res.status(500).json({ message: error.message });
//      }
//  };

// export const generateQuestion = async (req, res) => {
//     try {
//         const { role, experience, mode, resumeText, projects, skills } = req.body

//         role = role?.trim();
//         experience = experience?.trim();
//         mode = mode?.trim();

//         if(!role || !experience || !mode) {
//             return res.status(400).json({message:"Role, Experience and Mode are required."})
//         }

//         const user = await User.findById(req.userId)

//         if(!user) {
//             return res.status(404).json({
//                 message: "User not found."
//             });
//         }

//         if(user.credits < 50) {
//             return res.status(400).json({
//                 message: "Not enough credits. Minimum 50 required."
//             });
//         }

//         const projectText = Array.isArray(projects) && projects.length ? projects.join(", ")
//         : "None";

//         const skillsText = Array.isArray(skills) && skills.length ? skills.join(", ")
//         : "None";

//         const safeResume = resumeText?.trim() || "None";

//         const userPrompt = `
//         Role:${role}
//         Experience:${experience}
//         InterviewMode:${mode}
//         projects:${projectText}
//         skills:${skillsText}
//         Resume:${safeResume}`;

//         if(!userPrompt.trim()) {
//             return res.status(400).json({
//                 message: "Prompt content is empty."
//             });
//         }

//         // **Resume Prompt**

//  const messages = [
//        {
//          role: "system",
//          content: `
//  Extract structured data from resume.

//  Return strictly JSON:

//  {
//    "role": "string",
//    "experience": "string",
//    "projects": ["project1", "project2"],
//    "skills": ["skill1", "skill2"]
//  }
//  `
//        },
//        {
//          role: "user",
//          content: resumeText
//        }
//      ];



// // ** Generate Question Prompt **


// //  const userPrompt = `
// //      Role:${role}
// //      Experience:${experience}
// //      InterviewMode:${mode}
// //      Projects:${projectText}
// //      Skills:${skillsText},
// //      Resume:${safeResume}
// //      `;

// const messages = [

//       {
//         role: "system",
//         content: `
// You are a real human interviewer conducting a professional interview.

// Speak in simple, natural English as if you are directly talking to the candidate.

// Generate exactly 5 interview questions.

// Strict Rules:
// - Each question must contain between 15 and 25 words.
// - Each question must be a single complete sentence.
// - Do NOT number them.
// - Do NOT add explanations.
// - Do NOT add extra text before or after.
// - One question per line only.
// - Keep language simple and conversational.
// - Questions must feel practical and realistic.

// Difficulty progression:
// Question 1 → easy  
// Question 2 → easy  
// Question 3 → medium  
// Question 4 → medium  
// Question 5 → hard  

// Make questions based on the candidate’s role, experience,interviewMode, projects, skills, and resume details.
// `
//       }
//       ,
//       {
//         role: "user",
//         content: userPrompt
//       }
//     ];

//     const aiResponse = await askAi(messages)

//     if(!aiResponse || !aiResponse.trim()) {
//         return res.status(500).json({
//             message: "AI returned empty response."
//         });
//     }

//     const questionArray = aiResponse
//     .split("\n")
//     .map(q => q.trim())
//     .filter(q => q.length > 0)
//     .slice(0, 5);

//     if(questionsArray.length === 0) {
//         return res.status(500).json({
//             message: "AI failed to generate questions."
//         });
//     }

//     user.credits -= 50;
//     await user.save();

//     const interview = await Interview.create({
//         userId: user._id,
//         role,
//         experience,
//         mode,
//         resumeText:safeResume,
//         questions: questionArray.map((q, index) => ({
//             question: q,
//             difficulty: ["easy","easy","medium","medium","hard"][index],
//             timeLimit: [60,60,90,90,120][index],
//         }))
//     })

//     res.json({
//         interviewId: interview._id,
//         creditsLeft: user.credits,
//         userName: user.name,
//         questions: interview.questions
//     });


// const messages = [
//       {
//         role: "system",
//         content: `
// You are a professional human interviewer evaluating a candidate's answer in a real interview.

// Evaluate naturally and fairly, like a real person would.

// Score the answer in these areas (0 to 10):

// 1. Confidence – Does the answer sound clear, confident, and well-presented?
// 2. Communication – Is the language simple, clear, and easy to understand?
// 3. Correctness – Is the answer accurate, relevant, and complete?

// Rules:
// - Be realistic and unbiased.
// - Do not give random high scores.
// - If the answer is weak, score low.
// - If the answer is strong and detailed, score high.
// - Consider clarity, structure, and relevance.

// Calculate:
// finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

// Feedback Rules:
// - Write natural human feedback.
// - 10 to 15 words only.
// - Sound like real interview feedback.
// - Can suggest improvement if needed.
// - Do NOT repeat the question.
// - Do NOT explain scoring.
// - Keep tone professional and honest.

// Return ONLY valid JSON in this format:

// {
//   "confidence": number,
//   "communication": number,
//   "correctness": number,
//   "finalScore": number,
//   "feedback": "short human feedback"
// }
// `
//       }
//       ,
//       {
//         role: "user",
//         content: `
// Question: ${question.question}
// Answer: ${answer}
// `
//       }
//     ];


//     } catch (error) {
//     return res.status(500).json({ message: `failed to create interview due to ${error}` });
//   }
// }

// export const submitAnswer = async (req, res) => {
//     try {
//         const {interviewId, questionIndex, answer, timeTaken} = req.body
        
//         const interview = await Interview.findById(interviewId)
//         const question = interview.questions(questionIndex)

//         // If no answer
//         if(!answer) {
//             question.score = 0;
//             question.feedback = "You did not submit an answer";
//             question.answer = "";

//             await interview.save();

//             return res.json({
//                 feedback: question.feedback
//             });
//         }

//         // If time exceeded

//         if(timeTaken > question.timeLimit) {
//             question.score = 0;
//             question.feedback = "Time limit exceeded. Answer not evaluated";
//             question.answer = answer;

//             await interview.save();

//             return res.json({
//                 feedback: question.feedback
//             });
//         }

//         const messages = [
//       {
//         role: "system",
//         content: `
// You are a professional human interviewer evaluating a candidate's answer in a real interview.

// Evaluate naturally and fairly, like a real person would.

// Score the answer in these areas (0 to 10):

// 1. Confidence – Does the answer sound clear, confident, and well-presented?
// 2. Communication – Is the language simple, clear, and easy to understand?
// 3. Correctness – Is the answer accurate, relevant, and complete?

// Rules:
// - Be realistic and unbiased.
// - Do not give random high scores.
// - If the answer is weak, score low.
// - If the answer is strong and detailed, score high.
// - Consider clarity, structure, and relevance.

// Calculate:
// finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

// Feedback Rules:
// - Write natural human feedback.
// - 10 to 15 words only.
// - Sound like real interview feedback.
// - Can suggest improvement if needed.
// - Do NOT repeat the question.
// - Do NOT explain scoring.
// - Keep tone professional and honest.

// Return ONLY valid JSON in this format:

// {
//   "confidence": number,
//   "communication": number,
//   "correctness": number,
//   "finalScore": number,
//   "feedback": "short human feedback"
// }
// `
//       }
//       ,
//       {
//         role: "user",
//         content: `
// Question: ${question.question}
// Answer: ${answer}
// `
//       }
//     ];

//     const aiResponse = await askAi(messages)

//     const parsed = JSON.parse(aiResponse);

//     question.answer = answer;
//     question.confidence = parsed.confidence;
//     question.communication = parsed.communication;
//     question.correctness = parse.correctness;
//     question.score = parsed.finalScore;
//     question.feedback = parsed.feedback;
//     await interview.save();

//     return res.status(200).json({feedback :parsed.feedback})


//     } catch (error) {
//     return res.status(500).json({ message: `failed to submit answer due to ${error}` });
//   }
// }

// export const finishInterview = async (req, res) => {
//     try {
//         const {interviewId} = req.body
//         const interview =  await Interview.findById(interviewId)
//         if(!interview) {
//             return res.status(400).json({message:"failed to find Interview"})
//         }

//         const totalQuestions = interview.questions.length;

//         let totalScore = 0;
//         let totalConfidence = 0;
//         let totalCommunication = 0;
//         let totalCorrectness = 0;

//         interview.questions.forEach((q) => {
//             totalScore += q.score || 0;
//             totalConfidence += q.confidence || 0;
//             totalCommunication += q.communication || 0;
//             totalCorrectness += q.correctness || 0;
//         });

//         const finalScore = totalQuestions ? totalScore / totalQuestions : 0;

//         const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;

//         const avgCommunication = totalQuestions ? totalCommunication / totalQuestions : 0;

//         const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;

//         interview.finalScore = finalScore;
//         interview.status = "completed";

//         await interview.save();

//         return res.status(200).json({
//             finalScore: Number(finalScore.toFixed(1)),
//             confidence: Number(avgConfidence.toFixed(1)),
//             communication: Number(avgCommunication.toFixed(1)),
//             correctness: Number(avgCorrectness.toFixed(1)),
//             questionWiseScore: interview.questions.map((q) => ({
//                 question: q.question,
//                 score: q.score || 0,
//                 feedback: q.feedback || "",
//                 confidence: q.confidence || 0,
//                 communication: q.communication || 0,
//                 correctness: q.correctness || 0,
//             })),
//         })


//     } catch (error) {
//       return res.status(500).json({message:`failed to finish Interview ${error}`})
//     }
// }
 



//  AI Response

// import fs from "fs";
// import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// import { askAi } from "../services/openRouter.service.js";

// export const analyzeResume = async (req, res) => {
//     let filepath = null;

//     try {
//         if (!req.file) {
//             return res.status(400).json({
//                 message: "Resume required"
//             });
//         }

//         filepath = req.file.path;

//         const fileBuffer = await fs.promises.readFile(filepath);
//         const uint8Array = new Uint8Array(fileBuffer);

//         const pdf = await pdfjsLib.getDocument({
//             data: uint8Array
//         }).promise;

//         let resumeText = "";

//         // Extract text from all pages
//         for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
//             const page = await pdf.getPage(pageNum);
//             const content = await page.getTextContent();

//             const pageText = content.items
//                 .map(item => item.str)
//                 .join(" ");

//             resumeText += pageText + "\n";
//         }

//         resumeText = resumeText
//             .replace(/\s+/g, " ")
//             .trim();


// //         const messages = [
// //             {
// //                 role: "system",
// //                 content: `
// // You are a resume parser.

// // Extract structured information from the resume.

// // Return ONLY valid JSON.
// // Do NOT write any introduction.
// // Do NOT write any explanation.
// // Do NOT use markdown.
// // Do NOT wrap the JSON in \`\`\`json.

// // Use exactly this structure:

// // {
// //     "role": "string",
// //     "experience": "string",
// //     "projects": ["project1", "project2"],
// //     "skills": ["skill1", "skill2"]
// // }

// // If information is not available, use an empty string or empty array.
// // `
// //             },
// //             {
// //                 role: "user",
// //                 content: resumeText
// //             }
// //         ];

//         const aiResponse = await askAi(messages);


//         // Clean possible markdown fences
//         let cleanedResponse = aiResponse
//             .replace(/```json/gi, "")
//             .replace(/```/g, "")
//             .trim();

//         // Find JSON object if AI added text before/after it
//         const startIndex = cleanedResponse.indexOf("{");
//         const endIndex = cleanedResponse.lastIndexOf("}");

//         if (startIndex === -1 || endIndex === -1) {
//             throw new Error("AI did not return valid JSON.");
//         }

//         cleanedResponse = cleanedResponse.substring(
//             startIndex,
//             endIndex + 1
//         );

//         let parsed;

//         try {
//             parsed = JSON.parse(cleanedResponse);
//         } catch (jsonError) {
//             console.error("Invalid AI JSON:", cleanedResponse);
//             throw new Error("AI returned invalid JSON.");
//         }

//         // Validate expected fields
//         const result = {
//             role: parsed.role || "",
//             experience: parsed.experience || "",
//             projects: Array.isArray(parsed.projects)
//                 ? parsed.projects
//                 : [],
//             skills: Array.isArray(parsed.skills)
//                 ? parsed.skills
//                 : [],
//             resumeText
//         };

//         await fs.promises.unlink(filepath);
//         filepath = null;

//         return res.json(result);

//     } catch (error) {
//         console.error("Resume Analysis Error:", error);

//         // Delete uploaded file if it still exists
//         if (filepath && fs.existsSync(filepath)) {
//             await fs.promises.unlink(filepath);
//         }

//         return res.status(500).json({
//             message: error.message
//         });
//     }
// };
