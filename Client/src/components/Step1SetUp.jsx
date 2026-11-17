
import { motion } from "motion/react"
import { useState } from "react";
import {
  FaUserTie,
// FaBriefCase,
  FaFileUpload,
  FaMicrophoneAlt,
  FaChartLine,
  FaBriefcase,
} from "react-icons/fa";
import axios from "axios"
import { ServerUrl } from "../config/api";
import { useDispatch, useSelector } from "react-redux";
import { setUserData } from "../redux/userSlice";
import { interviewModes } from "../config/interviewModes";
import { useNavigate } from "react-router-dom";

function Step1SetUp({onStart}) {
  const {userData} = useSelector((state)=>state.user)
  const dispatch = useDispatch()
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [mode, setMode] = useState("Technical");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([])
  const [skills, setSkills] = useState([])
  const [resumeText, setResumeText] = useState("");
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [difficultyLevel, setDifficultyLevel] = useState("Intermediate");
  const [interviewerStyle, setInterviewerStyle] = useState("Professional");
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [jobDescription, setJobDescription] = useState("");
  const navigate = useNavigate();

  const handleUploadResume = async () => {
    if(!resumeFile || analyzing) return;
    setAnalyzing(true)
    setError("")

    const formdata = new FormData()
    formdata.append("resume",resumeFile)

    try {
      const result = await axios.post(ServerUrl + "/api/interview/resume", formdata, {withCredentials:true})

       setRole(result.data.role || "");
       setExperience(result.data.experience || "");
       setProjects(result.data.projects || []);
       setSkills(result.data.skills || []);
       setResumeText(result.data.resumeText || "");
       setAnalysisDone(true);
      } catch (error) {
        setError(error.response?.data?.message || "Unable to analyze this resume.");
      } finally { setAnalyzing(false); }
  }

     const handleStart = async () => {
      setLoading(true)
      setError("")
      setNeedsCredits(false)
      try {
       const result = await axios.post(
      ServerUrl + "/api/interview/generate-questions",
      { role, experience, mode, resumeText, projects, skills, requestId, difficultyLevel, interviewerStyle, adaptiveMode, jobDescription },
      { withCredentials: true }
);
        if(userData) {
          dispatch(setUserData({...userData , credits: result.data.creditsLeft}))
        }
        setLoading(false)
        onStart(result.data)

      } catch (error) {
        setError(error.response?.data?.message || "Unable to start the interview.")
        setNeedsCredits(Boolean(error.response?.data?.requiredCredits))
        setLoading(false)
      }
     }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4">

        <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl grid md:grid-cols-2 overflow-hidden">

             <motion.div
             initial={{ x: -80, opacity: 0 }}
             animate={{ x: 0, opacity: 1 }}
             transition={{ duration: 0.7 }}
             className="relative bg-gradient-to-br from-green-50 to-green-100 p-12 flex flex-col justify-center">

              <h2 className="text-4xl font-bold text-gray-800 mb-6">Start Your AI Interview</h2>

              <p className="text-gray-600 mb-10">Practice real interview scenarios powered by AI.
                Improve communication, technical skills, and confidence.
              </p>

              <div className="space-y-5">

                {
                  [
                    {
                      icon: <FaUserTie className="text-green-600 text-xl" />,
                      text: "Choose Role & Experience",
                  },
                  {
                      icon: <FaMicrophoneAlt className="text-green-600 text-xl" />,
                      text: "Smart Voice Interview",
                },
                 {
                      icon: <FaChartLine className="text-green-600 text-xl" />,
                      text: "Performance Analytics",
                },
              ].map((item,index) => (
                <motion.div key={index}
                initial={{ y: 30, op: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.15 }}
                whileHover={{ scale: 1.03 }}
                className="flex items-center space-x-4 bg-white p-4 rounded-xl shadow-sm cursor-pointer">
                  {item.icon}
                  <span className="text-gray-700 font-medium">{item.text}</span>
                </motion.div>
              ))
                 }   
                </div>


             </motion.div>

             <motion.div
               initial={{ x: 80, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               transition={{ duration: 0.7 }}
               className="p-12 bg-white">

                <h2 className="text-3xl font-bold text-gray-800 mb-8">
                  Interview SetUp
                </h2>

                <div className="space-y-6">

                  <div className="relative">
                    <FaUserTie className="absolute top-4 left-4 text-gray-400"/>

                    <input type="text" placeholder="Enter role"
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                    onChange={(e)=>setRole(e.target.value)} value={role}/>
                  </div>

                   <div className="relative">
                    <FaBriefcase className="absolute top-4 left-4 text-gray-400"/>

                    <input type="text" placeholder="Experience"
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                    onChange={(e)=>setExperience(e.target.value)} value={experience}/>

                  </div>

                  <select value={mode}
                    onChange={(e)=>setMode(e.target.value)}
                    className="w-full py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition">

                        {interviewModes.map((interviewMode) => <option key={interviewMode} value={interviewMode}>{interviewMode} Interview</option>)}

                    </select>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <select value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)} className="w-full py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition">
                        <option value="Beginner">Beginner difficulty</option><option value="Intermediate">Intermediate difficulty</option><option value="Advanced">Advanced difficulty</option>
                      </select>
                      <select value={interviewerStyle} onChange={(e) => setInterviewerStyle(e.target.value)} className="w-full py-3 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition">
                        <option value="Professional">Professional interviewer</option><option value="Friendly">Friendly interviewer</option><option value="Challenging">Challenging interviewer</option>
                      </select>
                    </div>
                    <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste a job description (optional)" className="min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:ring-2 focus:ring-green-500" />
                    <label className="flex items-center gap-3 text-sm text-gray-600"><input checked={adaptiveMode} onChange={(e) => setAdaptiveMode(e.target.checked)} type="checkbox" className="h-4 w-4 accent-green-600" />Adaptive follow-up questions</label>
                    {!analysisDone && (
                      <motion.div 
                      whileHover={{ scale:1.02 }}
                      onClick={()=>document.getElementById("resumeUpload").click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition">

                        <FaFileUpload className="text-4xl mx-auto text-green-600 mb-3"/>

                        <input type="file" 
                        accept="application/pdf"
                        id="resumeUpload" 
                        className="hidden"
                        onChange={(e)=>setResumeFile(e.target.files[0])} />

                        <p className="text-gray-600 font-medium">
                          {resumeFile ? resumeFile.name : "Click to upload resume (optional)"}
                        </p>

                        {resumeFile && (
                          <motion.button
                           whileHover={{scale:1.02}}
                          onClick={(e) => {
                          e.stopPropagation();
                          handleUploadResume();
                         }}

                           className="mt-4 bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-800 transition">
                            {analyzing ? "Analyzing..." : "Analyze Resume"}

                        </motion.button>)}

                      </motion.div>
                    )}

                   {analysisDone && (
                    <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">Resume Analysis Result</h3>

                      {projects.length > 0 &&(
                        <div>
                          <p className="font-medium text-gray-700 mb-1">
                            Projects:
                          </p>
                          
                          <ul className="list-disc list-inside text-gray-600 space-y-1">
                            {projects.map((p,i)=>(
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                   )} 

                   {skills.length > 0 &&(
                        <div>
                          <p className="font-medium text-gray-700 mb-1">
                            Skills:
                          </p>
                          
                          <div className="flex flex-wrap gap-2">
                            {skills.map((s,i)=>(
                              <span key={i} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">{s}</span>
                            ))}
                          </div>

                        </div>
                     )}

                     </motion.div>
                  )}

                  {error && <div className="text-sm text-red-600"><p>{error}</p>{needsCredits && <button onClick={() => navigate("/pricing")} className="mt-2 font-semibold text-green-700 underline">Buy credits</button>}</div>}

                    <motion.button
                    onClick={handleStart}
                      disabled={!role || !experience || loading}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full disabled:bg-gray-600 hover:bg-green-600 text-white py-3 rounded-full text-lg font-semibold transition duration-300 shadow-md">
                       {loading ? "Starting..." : "Start Interview"}

                    </motion.button>
                </div>
               </motion.div>

        </div>

    </motion.div>
  )
}

export default Step1SetUp
