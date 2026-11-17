
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Step3Report from "../components/Step3Report";
import { ServerUrl } from "../config/api";

function InterviewReport() {
  const { interviewId } = useParams(); const [report, setReport] = useState(null); const [error, setError] = useState("");
  useEffect(() => { axios.get(`${ServerUrl}/api/interview/${interviewId}`, { withCredentials: true }).then((response) => setReport(response.data)).catch((requestError) => setError(requestError.response?.data?.message || "Unable to load this report.")); }, [interviewId]);
  if (error) return <div className="min-h-screen p-10 text-center text-red-600">{error}</div>;
  if (!report) return <div className="min-h-screen p-10 text-center text-gray-500">Loading report...</div>;
  return <Step3Report report={report} />;
}
export default InterviewReport;
