import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

function Timer({ timeLeft, totalTime }) {
  const percentage = totalTime ? Math.max(0, (timeLeft / totalTime) * 100) : 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="w-24 h-24" aria-label={`${timeLeft} seconds remaining`}>
      <CircularProgressbar value={percentage} text={`${minutes}:${seconds}`} styles={buildStyles({ textSize: "22px", pathColor: timeLeft <= 10 ? "#ef4444" : "#10b981", textColor: "#111827", trailColor: "#e5e7eb" })} />
    </div>
  );
}

export default Timer;
