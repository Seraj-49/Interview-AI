export const INTERVIEW_MODES = {
    Technical: "DSA, programming, problem-solving, core technical concepts, and practical debugging.",
    HR: "introductions, strengths, weaknesses, teamwork, communication, and behavioural situations.",
    "Frontend Developer": "HTML, CSS, JavaScript, TypeScript, React, browser behaviour, accessibility, and frontend architecture.",
    "Backend Developer": "Node.js, Express, databases, APIs, authentication, security, and backend system fundamentals.",
    "Full Stack Developer": "frontend, backend, databases, APIs, authentication, and integration trade-offs.",
    "System Design": "architecture, scalability, databases, caching, reliability, and design decisions.",
    Mixed: "a balanced mix of technical, HR, and role-specific questions.",
};

export const getInterviewCost = (mode) => {
    const key = `INTERVIEW_CREDIT_COST_${mode.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    const configured = Number(process.env[key] ?? process.env.INTERVIEW_CREDIT_COST ?? 50);
    return Number.isInteger(configured) && configured > 0 ? configured : 50;
};
