import { useState, useEffect, useCallback, useRef } from "react";
import client from "../../api/client";

/*
  useGameSession
  Manages all game state and API calls for the investigation.
  The 3D scene (WarehouseScene) is a pure renderer — this hook is the brain.

  Phases (managed by InvestigationScreen, not this hook):
    cutscene → briefing → exploring → why-chain → finished
  
  Timer lives here; starts only when InvestigationScreen tells us to (startTimer()).
*/

export default function useGameSession(caseId = "case001") {
  const [attemptId,    setAttemptId]    = useState(null);
  const [incident,     setIncident]     = useState(null);   // full incident (no correctOptionIds)
  const [cluesFound,   setCluesFound]   = useState(0);
  const [runningScore, setRunningScore] = useState(0);
  const [timeLeft,     setTimeLeft]     = useState(180);    // 3 minutes per game-design.md
  const [timerActive,  setTimerActive]  = useState(false);
  const [feedback,     setFeedback]     = useState(null);   // { message, isPositive }

  // 5-Why chain state
  const [whyStep,      setWhyStep]      = useState(1);      // current step 1-5
  const [whyDone,      setWhyDone]      = useState(false);  // all 5 answered
  const [lastResult,   setLastResult]   = useState(null);   // { correct, pointDelta }

  const finishCalledRef = useRef(false);
  const clickPendingRef = useRef(false);
  const whyPendingRef = useRef(false);
  const finishArgsRef = useRef(null);
  const [finishError, setFinishError] = useState(null);

  const [initLoading, setInitLoading] = useState(true);
  const [initError,   setInitError]   = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0); // 0 → 50 → 100

  // ── Init: fetch incident + start attempt ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function init() {
      try {
        // Step 1 of 2 — fetch incident data for this case
        const incRes = await client.get("/game/incident", { params: { caseId }, signal: controller.signal });
        if (cancelled) return;
        const inc = incRes.data;
        setIncident(inc);
        setLoadingProgress(50);            // step 1 complete

        // Step 2 of 2 — create attempt
        const startRes = await client.post("/game/start", { incidentId: inc._id });
        if (cancelled) return;
        setAttemptId(startRes.data.attemptId);
        setLoadingProgress(100);           // step 2 complete
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to start game", err);
        setInitError(
          err.response?.data?.error ||
          err.message ||
          "Failed to load the investigation"
        );
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    }
    init();
    return () => { cancelled = true; controller.abort(); };
  }, [caseId]); // caseId is set once at mount and never changes during a session

  // ── Timer countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timerActive, timeLeft]);

  const startTimer = useCallback(() => setTimerActive(true), []);
  const stopTimer  = useCallback(() => setTimerActive(false), []);

  // ── Hotspot click ─────────────────────────────────────────────────────────
  const handleHotspotClick = useCallback(async (hotspotId) => {
    if (!attemptId || clickPendingRef.current || finishCalledRef.current) return;
    clickPendingRef.current = true;
    try {
      const res  = await client.post("/game/clue-click", { attemptId, hotspotId });
      const data = res.data;

      setRunningScore(data.score);
      // Enrich payload so the feedback panel can show relevant/irrelevant framing + exact delta
      setFeedback({
        message:      data.feedback,
        isPositive:   data.pointDelta > 0,
        pointDelta:   data.pointDelta,
        isDecoy:      !!data.isDecoy,
        alreadyFound: !!data.alreadyFound,
      });

      if (data.found && !data.alreadyFound) {
        setCluesFound(c => c + 1);
      }
    } catch (err) {
      setFeedback({ message: err.response?.data?.error || "Could not save this clue. Please try again.", isPositive: false });
    } finally { clickPendingRef.current = false; }
  }, [attemptId]);

  // ── Submit one Why step ───────────────────────────────────────────────────
  const submitWhyStep = useCallback(async (optionId) => {
    if (!attemptId || whyPendingRef.current || finishCalledRef.current) return;
    whyPendingRef.current = true;
    try {
      const res  = await client.post("/game/submit-why", { attemptId, whyOrder: whyStep, optionId });
      const data = res.data;

      setRunningScore(data.score);
      setLastResult({ correct: data.correct, pointDelta: data.pointDelta });

      if (data.isFinal) {
        setWhyDone(true);
        stopTimer();
      } else {
        // Advance to next step
        setWhyStep(data.nextQuestion.order);
      }

      return data;
    } catch (err) {
      throw new Error(err.response?.data?.error || "Could not save your answer. Please try again.");
    } finally { whyPendingRef.current = false; }
  }, [attemptId, whyStep, stopTimer]);

  // ── Finish game ───────────────────────────────────────────────────────────
  const finishGame = useCallback(async (timeTakenSeconds, timedOut = false) => {
    if (!attemptId || finishCalledRef.current) return null;
    finishArgsRef.current = { timeTakenSeconds, timedOut };
    setFinishError(null);
    finishCalledRef.current = true;
    stopTimer();
    try {
      const res = await client.post("/game/finish", { attemptId, timeTakenSeconds, timedOut });
      return res.data;
    } catch (err) {
      finishCalledRef.current = false;
      setFinishError(err.response?.data?.error || "Could not save your result. Please try again.");
      return null;
    }
  }, [attemptId, stopTimer]);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  // Current why-chain question (from incident data, no correctOptionId)
  const currentWhyQuestion = incident?.whyChain
    ? incident.whyChain.find(w => w.order === whyStep) || null
    : null;

  return {
    attemptId, incident, cluesFound, runningScore,
    timeLeft, timerActive,
    feedback, clearFeedback,
    whyStep, whyDone, lastResult, currentWhyQuestion,
    startTimer, stopTimer,
    handleHotspotClick, submitWhyStep, finishGame,
    finishCalledRef,
    initLoading, initError, loadingProgress, finishError,
    retryFinish: () => finishArgsRef.current ? finishGame(finishArgsRef.current.timeTakenSeconds, finishArgsRef.current.timedOut) : Promise.resolve(null),
  };
}
