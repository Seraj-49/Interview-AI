import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { ServerUrl } from "../config/api";

function History() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");

  useEffect(() => {
    axios.get(`${ServerUrl}/api/user/interviews`, { withCredentials: true })
      .then((response) => setInterviews(response.data))
      .catch((requestError) => setError(requestError.response?.data?.message || "Unable to load your interview history."))
      .finally(() => setLoading(false));
  }, []);

  const deleteInterview = async (id) => {
    if (!window.confirm("Delete this interview and its report? This cannot be undone.")) return;
    setDeleting(id); setError("");
    try { await axios.delete(`${ServerUrl}/api/user/interviews/${id}`, { withCredentials: true }); setInterviews((current) => current.filter((interview) => interview.id !== id)); }
    catch (requestError) { setError(requestError.response?.data?.message || "Unable to delete this interview."); }
    finally { setDeleting(""); }
  };

  return <div className="min-h-screen bg-gray-50"><Navbar /><main className="mx-auto max-w-5xl px-5 py-12"><h1 className="text-3xl font-bold">Interview history</h1><p className="mt-2 text-gray-500">Review the completed practice sessions tied to your account.</p>
    {loading && <p className="mt-8 text-gray-500">Loading history...</p>}
    {error && <p className="mt-8 text-red-600">{error}</p>}
    {!loading && !error && interviews.length === 0 && <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm"><p className="text-gray-600">No completed interviews yet.</p><Link to="/interview" className="mt-4 inline-block rounded-full bg-gray-900 px-5 py-2 text-white">Start an interview</Link></div>}
    <div className="mt-8 grid gap-4">{interviews.map((interview) => <article key={interview.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm"><div><p className="text-xl font-semibold">{interview.role}</p><p className="mt-1 text-sm text-gray-500">{interview.mode} · {interview.experience} · {interview.questionCount} questions</p><p className="mt-2 text-sm text-gray-400">{new Date(interview.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-3"><p className="rounded-full bg-emerald-100 px-4 py-2 font-bold text-emerald-700">{interview.finalScore}/10</p><Link to={`/history/${interview.id}`} className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50">View report</Link><button onClick={() => deleteInterview(interview.id)} disabled={deleting === interview.id} className="rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">{deleting === interview.id ? "Deleting..." : "Delete"}</button></div></article>)}</div>
  </main></div>;
}

export default History;
