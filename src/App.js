import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, RotateCcw, Target, BookOpen, Award, Eye, EyeOff,
  Calculator, Brain, CheckCircle2, XCircle, ArrowRight, Waves, Scale, Compass
} from 'lucide-react';

// --- Added: reusable arrow primitive for the small SVG diagrams below.
// (The main canvas draws its own arrowheads with canvas 2D calls; these new
// mini-diagrams use plain SVG instead, since they're static, non-draggable
// illustrations and don't need a canvas ref/useEffect of their own.)
const SvgArrow = ({ x1, y1, x2, y2, color, width = 2.5, dashed = false }) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 8;
  const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6);
  const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6);
  const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6);
  const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6);
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={width}
        strokeDasharray={dashed ? '5,4' : undefined}
      />
      <polygon points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`} fill={color} />
    </g>
  );
};

const VectorAdditionPlayground = () => {
  const canvasRef = useRef(null);
  const [vectors, setVectors] = useState([
    { id: 1, x: 100, y: 50, color: '#3b82f6', label: 'A' },
    { id: 2, x: 50, y: 80, color: '#ef4444', label: 'B' }
  ]);
  const [nextId, setNextId] = useState(3);
  const [dragging, setDragging] = useState(null);
  const [mode, setMode] = useState('tail-to-tip'); // 'tail-to-tip' or 'parallelogram'
  const [showComponents, setShowComponents] = useState(true);
  const [showResultant, setShowResultant] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [scale, setScale] = useState(1);
  const [challenge, setChallenge] = useState(null);
  const [challengeMode, setChallengeMode] = useState(false);
  const [score, setScore] = useState(0);

  // --- Added: polar (magnitude/angle) editing + "show working" ---
  const [showWorking, setShowWorking] = useState(false);

  // --- Added: Component Resolution Practice mode ---
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceQuestion, setPracticeQuestion] = useState(null); // { V, theta }
  const [practiceInputs, setPracticeInputs] = useState({ vx: '', vy: '' });
  const [practiceFeedback, setPracticeFeedback] = useState(null); // { correct, message }
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceAttempts, setPracticeAttempts] = useState(0);

  // --- Added: angle convention toggle ('math' = CCW from +x; 'bearing' = CW from N) ---
  const [angleConvention, setAngleConvention] = useState('math');

  // --- Added: specify-a-new-vector form (Add Vector used to be random-only) ---
  const [newVecMag, setNewVecMag] = useState('10');
  const [newVecAngle, setNewVecAngle] = useState('0');

  // --- Added: Relative Velocity (river-crossing) lab ---
  const [riverMode, setRiverMode] = useState(false);
  const [riverWidth, setRiverWidth] = useState(200);   // metres
  const [currentSpeed, setCurrentSpeed] = useState(3); // m/s, fixed along +x (downstream)
  const [boatSpeed, setBoatSpeed] = useState(4);       // m/s relative to water
  const [boatHeading, setBoatHeading] = useState(90);  // standard degrees; 90 = straight across

  // --- Added: Equilibrium (three-force) lab ---
  const [equilibriumMode, setEquilibriumMode] = useState(false);
  const [eqForces, setEqForces] = useState({ f1: { V: 14, theta: 50 }, f2: { V: 9, theta: 200 } });
  const [eqGuess, setEqGuess] = useState({ V: '', theta: '' });
  const [eqFeedback, setEqFeedback] = useState(null);
  const [eqSolved, setEqSolved] = useState(false);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const ORIGIN_X = CANVAS_WIDTH / 2;
  const ORIGIN_Y = CANVAS_HEIGHT / 2;
  const PIXELS_PER_UNIT = 20;

  // Generate challenge
  const generateChallenge = () => {
    const targetX = Math.floor(Math.random() * 10 - 5) * 20;
    const targetY = Math.floor(Math.random() * 10 - 5) * 20;
    // Added: require combining at least 2-4 vectors, otherwise a single vector
    // dragged straight to the target trivially "solves" it without any addition.
    const minVectors = Math.floor(Math.random() * 3) + 2;
    setChallenge({ x: targetX, y: targetY, minVectors });
    setVectors([]);
    setNextId(1);
    setChallengeMode(true);
  };

  // Check challenge completion
  const checkChallenge = () => {
    if (!challenge) return;
    if (vectors.length < challenge.minVectors) {
      alert(`Add at least ${challenge.minVectors} vectors before checking — you currently have ${vectors.length}. This challenge is about combining vectors, not aiming one.`);
      return;
    }
    const resultant = calculateResultant();
    const distance = Math.sqrt(
      Math.pow(resultant.x - challenge.x, 2) + 
      Math.pow(resultant.y - challenge.y, 2)
    );
    if (distance < 15) {
      setScore(score + 1);
      alert('🎉 Challenge completed! Creating new challenge...');
      generateChallenge();
    } else {
      alert(`Not quite! You're ${distance.toFixed(1)}px away from the target.`);
    }
  };

  const calculateResultant = () => {
    const totalX = vectors.reduce((sum, v) => sum + v.x, 0);
    const totalY = vectors.reduce((sum, v) => sum + v.y, 0);
    return { x: totalX, y: totalY };
  };

  // --- Added (bug fix): screen-space tail position of the vector at `index`.
  // In parallelogram mode every vector's tail is the origin. In tail-to-tip mode
  // each vector's tail is the tip of the chain of vectors before it — the drag
  // handlers previously ignored this and always measured from the origin, which
  // is why only the first vector could be dragged correctly in tail-to-tip mode.
  const getScreenTail = (index) => {
    if (mode !== 'tail-to-tip') return { x: ORIGIN_X, y: ORIGIN_Y };
    let cx = ORIGIN_X;
    let cy = ORIGIN_Y;
    for (let i = 0; i < index; i++) {
      cx += vectors[i].x * scale;
      cy -= vectors[i].y * scale;
    }
    return { x: cx, y: cy };
  };

  // --- Added: Cartesian <-> polar helpers ---
  // theta is returned in degrees, standard math convention (CCW from +x axis), range [0, 360).
  const getPolar = (v) => {
    const V = Math.sqrt(v.x * v.x + v.y * v.y);
    let theta = Math.atan2(v.y, v.x) * 180 / Math.PI;
    if (theta < 0) theta += 360;
    return { V, theta };
  };

  // --- Added: angle-convention conversion ---
  // 'math': degrees CCW from +x (East). 'bearing': compass bearing, degrees CW from +y (North).
  // Because North sits at 90 degrees in the math convention, the conversion is
  // self-inverse: applying it twice returns the original angle either way.
  const toDisplayAngle = (stdDeg) => {
    const norm = ((stdDeg % 360) + 360) % 360;
    return angleConvention === 'bearing' ? (90 - norm + 360) % 360 : norm;
  };
  const fromDisplayAngle = (dispDeg) => {
    const norm = ((dispDeg % 360) + 360) % 360;
    return angleConvention === 'bearing' ? (90 - norm + 360) % 360 : norm;
  };
  const angleUnitLabel = angleConvention === 'bearing' ? '° bearing, CW from N' : '° from +x, CCW';

  const setVectorMagnitude = (id, newV) => {
    if (Number.isNaN(newV)) return;
    setVectors(vectors.map(v => {
      if (v.id !== id) return v;
      const { theta } = getPolar(v);
      const rad = theta * Math.PI / 180;
      return { ...v, x: newV * Math.cos(rad), y: newV * Math.sin(rad) };
    }));
  };

  const setVectorAngle = (id, newDisplayAngle) => {
    if (Number.isNaN(newDisplayAngle)) return;
    const newTheta = fromDisplayAngle(newDisplayAngle);
    setVectors(vectors.map(v => {
      if (v.id !== id) return v;
      const { V } = getPolar(v);
      const rad = newTheta * Math.PI / 180;
      return { ...v, x: V * Math.cos(rad), y: V * Math.sin(rad) };
    }));
  };

  // --- Added: Component Resolution Practice mode ---
  // Deliberately biases toward non-first-quadrant angles, since Vx/Vy sign errors
  // outside 0-90 degrees are the most common mistake this mode targets.
  const generatePracticeQuestion = () => {
    const V = Math.floor(Math.random() * 16) + 5; // 5 - 20
    let theta;
    do {
      theta = Math.floor(Math.random() * 72) * 5; // multiples of 5, 0-355
    } while (theta % 90 === 0); // skip trivial axis-aligned angles
    setPracticeQuestion({ V, theta });
    setPracticeInputs({ vx: '', vy: '' });
    setPracticeFeedback(null);
    setPracticeMode(true);
  };

  const checkPracticeAnswer = () => {
    if (!practiceQuestion) return;
    const { V, theta } = practiceQuestion;
    const rad = theta * Math.PI / 180;
    const correctVx = V * Math.cos(rad);
    const correctVy = V * Math.sin(rad);
    const dispTheta = toDisplayAngle(theta).toFixed(1);

    const userVx = parseFloat(practiceInputs.vx);
    const userVy = parseFloat(practiceInputs.vy);

    if (Number.isNaN(userVx) || Number.isNaN(userVy)) {
      setPracticeFeedback({ correct: false, message: 'Enter a number for both Vx and Vy.' });
      return;
    }

    const tol = 0.3;
    const vxOk = Math.abs(userVx - correctVx) < tol;
    const vyOk = Math.abs(userVy - correctVy) < tol;
    setPracticeAttempts(practiceAttempts + 1);

    if (vxOk && vyOk) {
      setPracticeScore(practiceScore + 1);
      setPracticeFeedback({
        correct: true,
        message: `Correct — Vx = ${correctVx.toFixed(1)}, Vy = ${correctVy.toFixed(1)}.`
      });
      return;
    }

    // Diagnose the specific mistake rather than just saying "wrong".
    const vxSignFlip = !vxOk && Math.abs(Math.abs(userVx) - Math.abs(correctVx)) < tol;
    const vySignFlip = !vyOk && Math.abs(Math.abs(userVy) - Math.abs(correctVy)) < tol;

    if (vxSignFlip && vyOk) {
      setPracticeFeedback({ correct: false, message: `Magnitude of Vx is right, but the sign is wrong — which side of the y-axis does ${dispTheta}° put you on?` });
    } else if (vySignFlip && vxOk) {
      setPracticeFeedback({ correct: false, message: `Magnitude of Vy is right, but the sign is wrong — is ${dispTheta}° above or below the x-axis?` });
    } else if (vxSignFlip && vySignFlip) {
      setPracticeFeedback({ correct: false, message: `Both magnitudes are right, but check your signs — which quadrant is ${dispTheta}° actually in?` });
    } else {
      setPracticeFeedback({ correct: false, message: `Not quite. Recompute Vx and Vy for V = ${V}, θ = ${dispTheta}°.` });
    }
  };

  // --- Added: Relative Velocity (river-crossing) lab ---
  // River current is fixed along +x ("downstream"). Boat heading uses the same
  // standard (V, theta) convention as every other vector in the app: 90 deg is
  // straight across, 180 deg is directly upstream.
  const getRiverSolution = () => {
    const boatRad = boatHeading * Math.PI / 180;
    const boatVec = { x: boatSpeed * Math.cos(boatRad), y: boatSpeed * Math.sin(boatRad) };
    const groundVec = { x: currentSpeed + boatVec.x, y: boatVec.y };
    const groundSpeed = Math.sqrt(groundVec.x ** 2 + groundVec.y ** 2);
    let groundAngle = Math.atan2(groundVec.y, groundVec.x) * 180 / Math.PI;
    if (groundAngle < 0) groundAngle += 360;
    const canCross = groundVec.y > 1e-3;
    const crossTime = canCross ? riverWidth / groundVec.y : null;
    const drift = canCross ? groundVec.x * crossTime : null;
    return { boatVec, groundVec, groundSpeed, groundAngle, canCross, crossTime, drift };
  };

  // --- Added: velocity-vector mini diagram data (Current, Boat, Ground chained
  // tail-to-tip, independently auto-scaled — these are m/s, not metres, so they
  // must NOT share a scale with the trajectory diagram below).
  const getRiverVelocityDiagram = () => {
    const river = getRiverSolution();
    const w = 220, h = 190;
    const originX = 40, originY = h - 30;
    const pts = [
      { x: 0, y: 0 },
      { x: currentSpeed, y: 0 },
      { x: river.groundVec.x, y: river.groundVec.y }
    ];
    const maxAbsX = Math.max(...pts.map(p => Math.abs(p.x)), 1);
    const maxAbsY = Math.max(...pts.map(p => Math.abs(p.y)), 1);
    const scale = Math.min((w - 60) / maxAbsX, (h - 50) / maxAbsY);
    const toScreen = (x, y) => ({ x: originX + x * scale, y: originY - y * scale });
    return {
      w, h,
      O: toScreen(0, 0),
      currentTip: toScreen(currentSpeed, 0),
      groundTip: toScreen(river.groundVec.x, river.groundVec.y),
      river
    };
  };

  // --- Added: top-down trajectory diagram data (metres). Independent scale
  // from the velocity diagram above — river width always fills the vertical
  // span exactly; the horizontal span auto-fits the drift.
  const getRiverTrajectoryDiagram = () => {
    const river = getRiverSolution();
    const w = 260, h = 260;
    const farBankY = 30, nearBankY = 230;
    const startX = w / 2;
    const drift = river.canCross ? river.drift : 0;
    const horizontalExtent = Math.max(Math.abs(drift), 20);
    const xScale = (w / 2 - 30) / horizontalExtent;
    const landingX = startX + drift * xScale;
    return { w, h, farBankY, nearBankY, startX, landingX, river, drift };
  };

  // Solves boatSpeed*cos(theta) = -currentSpeed for the heading that cancels all drift.
  const solveZeroDrift = () => {
    if (currentSpeed >= boatSpeed) {
      alert('Current speed is not less than boat speed — zero drift is impossible: the boat cannot out-swim the current, no heading fixes this.');
      return;
    }
    const thetaRad = Math.acos(-currentSpeed / boatSpeed); // in (90 deg, 180 deg): upstream of straight-across
    setBoatHeading(Number((thetaRad * 180 / Math.PI).toFixed(1)));
  };

  // --- Added: Equilibrium (three-force) lab ---
  const generateEquilibriumProblem = () => {
    const V1 = Math.floor(Math.random() * 16) + 5;
    const V2 = Math.floor(Math.random() * 16) + 5;
    const th1 = Math.floor(Math.random() * 72) * 5;
    let th2;
    do {
      th2 = Math.floor(Math.random() * 72) * 5;
    } while (Math.abs(((th2 - th1) % 360 + 540) % 360 - 180) > 160); // keep F1, F2 non-degenerate
    setEqForces({ f1: { V: V1, theta: th1 }, f2: { V: V2, theta: th2 } });
    setEqGuess({ V: '', theta: '' });
    setEqFeedback(null);
    setEqSolved(false);
    setEquilibriumMode(true);
  };

  const getEquilibriumSolution = () => {
    const rad1 = eqForces.f1.theta * Math.PI / 180;
    const rad2 = eqForces.f2.theta * Math.PI / 180;
    const sumX = eqForces.f1.V * Math.cos(rad1) + eqForces.f2.V * Math.cos(rad2);
    const sumY = eqForces.f1.V * Math.sin(rad1) + eqForces.f2.V * Math.sin(rad2);
    const f3x = -sumX;
    const f3y = -sumY;
    const f3V = Math.sqrt(f3x ** 2 + f3y ** 2);
    let f3theta = Math.atan2(f3y, f3x) * 180 / Math.PI;
    if (f3theta < 0) f3theta += 360;
    return { sumX, sumY, f3x, f3y, f3V, f3theta };
  };

  // --- Added: force-triangle diagram data. F1 then F2 drawn tail-to-tip from
  // the origin; if the forces truly sum to zero, a correct F3 closes the
  // triangle back onto the origin — that visual gap *is* the residual.
  const getEquilibriumDiagram = () => {
    const rad1 = eqForces.f1.theta * Math.PI / 180;
    const rad2 = eqForces.f2.theta * Math.PI / 180;
    const f1vec = { x: eqForces.f1.V * Math.cos(rad1), y: eqForces.f1.V * Math.sin(rad1) };
    const tip1 = { x: f1vec.x, y: f1vec.y };
    const tip2 = { x: f1vec.x + eqForces.f2.V * Math.cos(rad2), y: f1vec.y + eqForces.f2.V * Math.sin(rad2) };

    const guessV = parseFloat(eqGuess.V);
    const guessThetaDisp = parseFloat(eqGuess.theta);
    let guessTip = null;
    if (!Number.isNaN(guessV) && !Number.isNaN(guessThetaDisp)) {
      const gRad = fromDisplayAngle(guessThetaDisp) * Math.PI / 180;
      guessTip = { x: tip2.x + guessV * Math.cos(gRad), y: tip2.y + guessV * Math.sin(gRad) };
    }

    const sol = getEquilibriumSolution();
    const solTip = { x: tip2.x + sol.f3x, y: tip2.y + sol.f3y }; // should land back on origin

    const pts = [{ x: 0, y: 0 }, tip1, tip2, solTip, ...(guessTip ? [guessTip] : [])];
    const w = 240, h = 240;
    const originX = w / 2, originY = h / 2;
    const maxAbs = Math.max(...pts.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))), 1);
    const scale = (Math.min(w, h) / 2 - 30) / maxAbs;
    const toScreen = (p) => ({ x: originX + p.x * scale, y: originY - p.y * scale });

    return {
      w, h,
      O: toScreen({ x: 0, y: 0 }),
      tip1: toScreen(tip1),
      tip2: toScreen(tip2),
      guessTipScreen: guessTip ? toScreen(guessTip) : null,
      solTipScreen: toScreen(solTip)
    };
  };

  const checkEquilibriumGuess = () => {
    const guessV = parseFloat(eqGuess.V);
    const guessThetaDisp = parseFloat(eqGuess.theta);
    if (Number.isNaN(guessV) || Number.isNaN(guessThetaDisp)) {
      setEqFeedback({ correct: false, message: 'Enter both a magnitude and an angle for F3.' });
      return;
    }
    const guessThetaStd = fromDisplayAngle(guessThetaDisp);
    const rad1 = eqForces.f1.theta * Math.PI / 180;
    const rad2 = eqForces.f2.theta * Math.PI / 180;
    const gRad = guessThetaStd * Math.PI / 180;
    const netX = eqForces.f1.V * Math.cos(rad1) + eqForces.f2.V * Math.cos(rad2) + guessV * Math.cos(gRad);
    const netY = eqForces.f1.V * Math.sin(rad1) + eqForces.f2.V * Math.sin(rad2) + guessV * Math.sin(gRad);
    const residual = Math.sqrt(netX ** 2 + netY ** 2);
    if (residual < 0.3) {
      setEqFeedback({ correct: true, message: `Balanced — residual |ΣF| = ${residual.toFixed(2)} units (rounding only).` });
    } else {
      setEqFeedback({ correct: false, message: `Not balanced — residual |ΣF| = ${residual.toFixed(2)} units. F3 must equal −(F1 + F2) component-wise.` });
    }
  };

  const addVector = (V, thetaStd) => {
    let x, y;
    if (typeof V === 'number' && typeof thetaStd === 'number' && !Number.isNaN(V) && !Number.isNaN(thetaStd)) {
      const rad = thetaStd * Math.PI / 180;
      x = V * Math.cos(rad);
      y = V * Math.sin(rad);
    } else {
      x = Math.random() * 100 - 50;
      y = Math.random() * 100 - 50;
    }
    const newVector = {
      id: nextId,
      x, y,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      label: String.fromCharCode(64 + nextId)
    };
    setVectors([...vectors, newVector]);
    setNextId(nextId + 1);
  };

  const deleteVector = (id) => {
    setVectors(vectors.filter(v => v.id !== id));
  };

  const resetVectors = () => {
    setVectors([
      { id: 1, x: 100, y: 50, color: '#3b82f6', label: 'A' },
      { id: 2, x: 50, y: 80, color: '#ef4444', label: 'B' }
    ]);
    setNextId(3);
    setChallengeMode(false);
    setChallenge(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i <= CANVAS_WIDTH; i += PIXELS_PER_UNIT) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let i = 0; i <= CANVAS_HEIGHT; i += PIXELS_PER_UNIT) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_WIDTH, i);
        ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, ORIGIN_Y);
    ctx.lineTo(CANVAS_WIDTH, ORIGIN_Y);
    ctx.stroke();
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, 0);
    ctx.lineTo(ORIGIN_X, CANVAS_HEIGHT);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('X', CANVAS_WIDTH - 20, ORIGIN_Y - 10);
    ctx.fillText('Y', ORIGIN_X + 10, 20);

    // Draw challenge target
    if (challenge && challengeMode) {
      const targetScreenX = ORIGIN_X + challenge.x;
      const targetScreenY = ORIGIN_Y - challenge.y;
      
      ctx.strokeStyle = '#fbbf24';
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(targetScreenX, targetScreenY, 20, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(targetScreenX - 15, targetScreenY);
      ctx.lineTo(targetScreenX + 15, targetScreenY);
      ctx.moveTo(targetScreenX, targetScreenY - 15);
      ctx.lineTo(targetScreenX, targetScreenY + 15);
      ctx.stroke();
      
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('🎯 TARGET', targetScreenX - 35, targetScreenY - 30);
    }

    const drawVector = (x, y, color, label, startX = ORIGIN_X, startY = ORIGIN_Y, alpha = 1) => {
      const endX = startX + x * scale;
      const endY = startY - y * scale;
      
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      
      // Vector line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Arrowhead
      const angle = Math.atan2(-(y * scale), x * scale);
      const arrowLength = 15;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle - Math.PI / 6),
        endY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle + Math.PI / 6),
        endY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      
      // Label
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(label, endX + 10, endY - 10);
      
      // Components
      if (showComponents) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        // X component
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, startY);
        ctx.stroke();
        
        // Y component
        ctx.beginPath();
        ctx.moveTo(endX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        ctx.setLineDash([]);
      }
      
      ctx.globalAlpha = 1;
    };

    // Draw vectors based on mode
    if (mode === 'tail-to-tip') {
      let currentX = ORIGIN_X;
      let currentY = ORIGIN_Y;
      
      vectors.forEach((vector, index) => {
        drawVector(vector.x, vector.y, vector.color, vector.label, currentX, currentY);
        currentX += vector.x * scale;
        currentY -= vector.y * scale;
      });
    } else {
      // Parallelogram mode
      vectors.forEach((vector) => {
        drawVector(vector.x, vector.y, vector.color, vector.label);
      });
      
      if (vectors.length === 2) {
        const v1 = vectors[0];
        const v2 = vectors[1];
        
        // Draw parallelogram sides
        ctx.strokeStyle = '#64748b';
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        const p1x = ORIGIN_X + v1.x * scale;
        const p1y = ORIGIN_Y - v1.y * scale;
        const p2x = ORIGIN_X + v2.x * scale;
        const p2y = ORIGIN_Y - v2.y * scale;
        const p3x = ORIGIN_X + (v1.x + v2.x) * scale;
        const p3y = ORIGIN_Y - (v1.y + v2.y) * scale;
        
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p3x, p3y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // Draw resultant
    if (showResultant && vectors.length > 0) {
      const resultant = calculateResultant();
      drawVector(resultant.x, resultant.y, '#22c55e', 'R', ORIGIN_X, ORIGIN_Y, 0.8);
    }
  }, [vectors, mode, showComponents, showResultant, showGrid, scale, challenge, challengeMode]);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check if clicking near any vector endpoint
    vectors.forEach((vector, index) => {
      if (dragging) return; // already found one this pass
      const tail = getScreenTail(index);
      const endX = tail.x + vector.x * scale;
      const endY = tail.y - vector.y * scale;
      const distance = Math.sqrt(Math.pow(mouseX - endX, 2) + Math.pow(mouseY - endY, 2));

      if (distance < 25) {
        setDragging(vector.id);
        e.preventDefault();
      }
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const index = vectors.findIndex(v => v.id === dragging);
    const tail = getScreenTail(index);
    const newX = (mouseX - tail.x) / scale;
    const newY = -(mouseY - tail.y) / scale;

    setVectors(vectors.map(v =>
      v.id === dragging ? { ...v, x: newX, y: newY } : v
    ));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleTouchStart = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches[0];
    const mouseX = (touch.clientX - rect.left) * scaleX;
    const mouseY = (touch.clientY - rect.top) * scaleY;

    vectors.forEach((vector, index) => {
      if (dragging) return;
      const tail = getScreenTail(index);
      const endX = tail.x + vector.x * scale;
      const endY = tail.y - vector.y * scale;
      const distance = Math.sqrt(Math.pow(mouseX - endX, 2) + Math.pow(mouseY - endY, 2));

      if (distance < 25) {
        setDragging(vector.id);
        e.preventDefault();
      }
    });
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches[0];
    const mouseX = (touch.clientX - rect.left) * scaleX;
    const mouseY = (touch.clientY - rect.top) * scaleY;

    const index = vectors.findIndex(v => v.id === dragging);
    const tail = getScreenTail(index);
    const newX = (mouseX - tail.x) / scale;
    const newY = -(mouseY - tail.y) / scale;

    setVectors(vectors.map(v =>
      v.id === dragging ? { ...v, x: newX, y: newY } : v
    ));
  };

  const handleTouchEnd = () => {
    setDragging(null);
  };

  const resultant = calculateResultant();
  const resultantMag = Math.sqrt(resultant.x ** 2 + resultant.y ** 2);
  const resultantAngle = Math.atan2(resultant.y, resultant.x) * 180 / Math.PI;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Vector Addition Playground
          </h1>
          <p className="text-gray-300">Explore vector addition through interactive visualization</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Main Canvas Area */}
          <div className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="rounded-lg cursor-crosshair w-full touch-none"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>

            {/* Mode Selector */}
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => setMode('tail-to-tip')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  mode === 'tail-to-tip'
                    ? 'bg-cyan-600 shadow-lg shadow-cyan-500/50'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Tail-to-Tip Method
              </button>
              <button
                onClick={() => setMode('parallelogram')}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  mode === 'parallelogram'
                    ? 'bg-cyan-600 shadow-lg shadow-cyan-500/50'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Parallelogram Method
              </button>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-4">
            {/* Vector Controls */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-4 text-cyan-400 flex items-center gap-2">
                <Plus size={20} /> Vector Controls
              </h2>
              
              <div className="space-y-3">
                {/* Added: specify a vector's magnitude/angle before creating it,
                    instead of adding a random one and fixing it up afterward. */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-400">
                    Magnitude
                    <input
                      type="number" step="0.5" value={newVecMag}
                      onChange={(e) => setNewVecMag(e.target.value)}
                      className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                    />
                  </label>
                  <label className="text-xs text-gray-400">
                    Angle ({angleUnitLabel})
                    <input
                      type="number" step="1" value={newVecAngle}
                      onChange={(e) => setNewVecAngle(e.target.value)}
                      className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                    />
                  </label>
                </div>
                <button
                  onClick={() => {
                    const V = parseFloat(newVecMag);
                    const thetaStd = fromDisplayAngle(parseFloat(newVecAngle));
                    addVector(V, thetaStd);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add This Vector
                </button>

                <button
                  onClick={() => addVector()}
                  className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add Random Vector
                </button>
                
                <button
                  onClick={resetVectors}
                  className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} /> Reset
                </button>

                <div className="pt-3 border-t border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Show Components</span>
                    <button
                      onClick={() => setShowComponents(!showComponents)}
                      className={`p-2 rounded ${showComponents ? 'bg-cyan-600' : 'bg-slate-600'}`}
                    >
                      {showComponents ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Show Resultant</span>
                    <button
                      onClick={() => setShowResultant(!showResultant)}
                      className={`p-2 rounded ${showResultant ? 'bg-cyan-600' : 'bg-slate-600'}`}
                    >
                      {showResultant ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show Grid</span>
                    <button
                      onClick={() => setShowGrid(!showGrid)}
                      className={`p-2 rounded ${showGrid ? 'bg-cyan-600' : 'bg-slate-600'}`}
                    >
                      {showGrid ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>

                  {/* Added: Show Working toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-600 mt-2">
                    <span className="text-sm flex items-center gap-1">
                      <Calculator size={14} /> Show Working
                    </span>
                    <button
                      onClick={() => setShowWorking(!showWorking)}
                      className={`p-2 rounded ${showWorking ? 'bg-cyan-600' : 'bg-slate-600'}`}
                    >
                      {showWorking ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>

                  {/* Added: Angle convention toggle */}
                  <div className="pt-2 border-t border-slate-600 mt-2">
                    <span className="text-sm flex items-center gap-1 mb-2">
                      <Compass size={14} /> Angle Convention
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAngleConvention('math')}
                        className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                          angleConvention === 'math' ? 'bg-cyan-600' : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      >
                        Standard (° from +x)
                      </button>
                      <button
                        onClick={() => setAngleConvention('bearing')}
                        className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                          angleConvention === 'bearing' ? 'bg-cyan-600' : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      >
                        Bearing (° CW from N)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vector List */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-4 text-cyan-400">Current Vectors</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {vectors.map((vector) => {
                  // Added: derive magnitude/angle from the canonical (x, y) so the
                  // polar fields below always stay in sync with drag edits.
                  const { V, theta } = getPolar(vector);
                  const rad = theta * Math.PI / 180;
                  return (
                    <div
                      key={vector.id}
                      className="bg-slate-700/50 p-3 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: vector.color }}
                          />
                          <div>
                            <div className="font-bold">{vector.label}</div>
                            <div className="text-xs text-gray-400">
                              ({vector.x.toFixed(1)}, {vector.y.toFixed(1)})
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteVector(vector.id)}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Added: editable magnitude/angle (polar) inputs */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <label className="text-xs text-gray-400">
                          Magnitude
                          <input
                            type="number"
                            step="0.5"
                            value={V.toFixed(1)}
                            onChange={(e) => setVectorMagnitude(vector.id, parseFloat(e.target.value))}
                            className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                          />
                        </label>
                        <label className="text-xs text-gray-400">
                          Angle ({angleUnitLabel})
                          <input
                            type="number"
                            step="1"
                            value={toDisplayAngle(theta).toFixed(1)}
                            onChange={(e) => setVectorAngle(vector.id, parseFloat(e.target.value))}
                            className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                          />
                        </label>
                      </div>

                      {/* Added: "show working" breakdown of the component resolution */}
                      {showWorking && (
                        <div className="mt-2 pt-2 border-t border-slate-600/60 text-xs font-mono text-gray-300 space-y-0.5">
                          {angleConvention === 'bearing' ? (
                            <>
                              <div>Vx = V·sin(β) = {V.toFixed(1)}·sin({toDisplayAngle(theta).toFixed(1)}°) = {(V * Math.cos(rad)).toFixed(1)}</div>
                              <div>Vy = V·cos(β) = {V.toFixed(1)}·cos({toDisplayAngle(theta).toFixed(1)}°) = {(V * Math.sin(rad)).toFixed(1)}</div>
                            </>
                          ) : (
                            <>
                              <div>Vx = V·cos(θ) = {V.toFixed(1)}·cos({theta.toFixed(1)}°) = {(V * Math.cos(rad)).toFixed(1)}</div>
                              <div>Vy = V·sin(θ) = {V.toFixed(1)}·sin({theta.toFixed(1)}°) = {(V * Math.sin(rad)).toFixed(1)}</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Results */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-4 text-cyan-400">Resultant Vector</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Components:</span>
                  <span className="font-mono">
                    ({resultant.x.toFixed(2)}, {resultant.y.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Magnitude:</span>
                  <span className="font-mono text-emerald-400">
                    {resultantMag.toFixed(2)} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Angle:</span>
                  <span className="font-mono text-cyan-400">
                    {toDisplayAngle(resultantAngle).toFixed(1)}°
                  </span>
                </div>
                {/* Added: show working for the resultant magnitude/angle */}
                {showWorking && (
                  <div className="mt-2 pt-2 border-t border-slate-600/60 text-xs font-mono text-gray-400 space-y-0.5">
                    <div>|R| = √(Rx² + Ry²) = √({resultant.x.toFixed(1)}² + {resultant.y.toFixed(1)}²) = {resultantMag.toFixed(1)}</div>
                    <div>θ = atan2(Ry, Rx) = atan2({resultant.y.toFixed(1)}, {resultant.x.toFixed(1)}) = {resultantAngle.toFixed(1)}°</div>
                    {angleConvention === 'bearing' && (
                      <div>β = 90° − θ = {toDisplayAngle(resultantAngle).toFixed(1)}°</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Challenge Mode */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-4 text-yellow-400 flex items-center gap-2">
                <Target size={20} /> Challenge Mode
              </h2>
              {!challengeMode ? (
                <button
                  onClick={generateChallenge}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 py-3 rounded-lg font-semibold transition-all"
                >
                  Start Challenge
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm">
                    <p className="text-gray-300 mb-2">
                      Add vectors (drag their tips, or type Magnitude/Angle in the
                      list above) so that their <span className="text-yellow-400 font-semibold">sum</span> lands
                      on the target (🎯) — not any single vector.
                    </p>
                    {challenge && (
                      <p className="text-xs text-gray-400 mb-2">
                        Required: at least <span className="text-white font-semibold">{challenge.minVectors}</span> vectors.
                        You have <span className={vectors.length >= challenge.minVectors ? 'text-emerald-400' : 'text-yellow-400'}>{vectors.length}</span>.
                      </p>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Score:</span>
                      <span className="text-2xl font-bold text-yellow-400">{score}</span>
                    </div>
                  </div>
                  <button
                    onClick={checkChallenge}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-semibold transition-all"
                  >
                    Check Solution
                  </button>
                  <button
                    onClick={() => {
                      setChallengeMode(false);
                      setChallenge(null);
                      resetVectors();
                    }}
                    className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm transition-all"
                  >
                    Exit Challenge
                  </button>
                </div>
              )}
            </div>

            {/* Added: Component Resolution Practice */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-4 text-purple-400 flex items-center gap-2">
                <Brain size={20} /> Component Practice
              </h2>
              {!practiceMode ? (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Given V and θ, predict Vx and Vy before the app draws anything —
                    no dragging allowed here.
                  </p>
                  <button
                    onClick={generatePracticeQuestion}
                    className="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-semibold transition-all"
                  >
                    Start Practice
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Score:</span>
                    <span className="text-xl font-bold text-purple-400">
                      {practiceScore} / {practiceAttempts}
                    </span>
                  </div>

                  {practiceQuestion && (
                    <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                      <div className="text-sm text-gray-400">Resolve this vector:</div>
                      <div className="text-lg font-mono text-white mt-1">
                        V = {practiceQuestion.V} units, θ = {toDisplayAngle(practiceQuestion.theta).toFixed(1)}°
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-400">
                      Vx =
                      <input
                        type="number"
                        step="0.1"
                        value={practiceInputs.vx}
                        onChange={(e) => setPracticeInputs({ ...practiceInputs, vx: e.target.value })}
                        className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="?"
                      />
                    </label>
                    <label className="text-xs text-gray-400">
                      Vy =
                      <input
                        type="number"
                        step="0.1"
                        value={practiceInputs.vy}
                        onChange={(e) => setPracticeInputs({ ...practiceInputs, vy: e.target.value })}
                        className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="?"
                      />
                    </label>
                  </div>

                  {practiceFeedback && (
                    <div className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
                      practiceFeedback.correct ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'
                    }`}>
                      {practiceFeedback.correct ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                      <span>{practiceFeedback.message}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={checkPracticeAnswer}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg text-sm font-semibold transition-all"
                    >
                      Check
                    </button>
                    <button
                      onClick={generatePracticeQuestion}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1"
                    >
                      Next <ArrowRight size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setPracticeMode(false);
                      setPracticeQuestion(null);
                      setPracticeFeedback(null);
                    }}
                    className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm transition-all"
                  >
                    Exit Practice
                  </button>
                </div>
              )}
            </div>

            {/* Added: Relative Velocity (river-crossing) lab */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-4 text-sky-400 flex items-center gap-2">
                <Waves size={20} /> Relative Velocity Lab
              </h2>
              {!riverMode ? (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Add a river current to a boat's velocity and find the resulting
                    ground track, crossing time, and downstream drift.
                  </p>
                  <button
                    onClick={() => setRiverMode(true)}
                    className="w-full bg-sky-600 hover:bg-sky-500 py-3 rounded-lg font-semibold transition-all"
                  >
                    Open River-Crossing Lab
                  </button>
                </>
              ) : (() => {
                const river = getRiverSolution();
                return (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">
                      Current flows along +x (downstream). Heading is in the same
                      convention as above: 90° is straight across, 180° is directly
                      upstream.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-gray-400">
                        River width (m)
                        <input
                          type="number" step="5" value={riverWidth}
                          onChange={(e) => setRiverWidth(parseFloat(e.target.value) || 0)}
                          className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        Current speed (m/s)
                        <input
                          type="number" step="0.5" value={currentSpeed}
                          onChange={(e) => setCurrentSpeed(parseFloat(e.target.value) || 0)}
                          className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        Boat speed rel. to water (m/s)
                        <input
                          type="number" step="0.5" value={boatSpeed}
                          onChange={(e) => setBoatSpeed(parseFloat(e.target.value) || 0)}
                          className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                      </label>
                      <label className="text-xs text-gray-400">
                        Boat heading ({angleUnitLabel})
                        <input
                          type="number" step="1" value={toDisplayAngle(boatHeading).toFixed(1)}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v)) setBoatHeading(fromDisplayAngle(v));
                          }}
                          className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                      </label>
                    </div>

                    {/* Added: velocity-vector diagram + top-down trajectory diagram */}
                    {(() => {
                      const vel = getRiverVelocityDiagram();
                      const traj = getRiverTrajectoryDiagram();
                      return (
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/40 rounded-lg p-2">
                          <div>
                            <svg viewBox={`0 0 ${vel.w} ${vel.h}`} className="w-full h-auto">
                              <circle cx={vel.O.x} cy={vel.O.y} r={3} fill="#94a3b8" />
                              <SvgArrow x1={vel.O.x} y1={vel.O.y} x2={vel.currentTip.x} y2={vel.currentTip.y} color="#facc15" />
                              <SvgArrow x1={vel.currentTip.x} y1={vel.currentTip.y} x2={vel.groundTip.x} y2={vel.groundTip.y} color="#38bdf8" />
                              <SvgArrow x1={vel.O.x} y1={vel.O.y} x2={vel.groundTip.x} y2={vel.groundTip.y} color="#34d399" width={2} dashed />
                            </svg>
                            <div className="text-[10px] text-gray-400 text-center mt-1 space-x-2">
                              <span className="text-yellow-400">■ current</span>
                              <span className="text-sky-400">■ boat</span>
                              <span className="text-emerald-400">■ ground</span>
                            </div>
                          </div>
                          <div>
                            <svg viewBox={`0 0 ${traj.w} ${traj.h}`} className="w-full h-auto">
                              <rect x={0} y={traj.farBankY} width={traj.w} height={traj.nearBankY - traj.farBankY} fill="#0ea5e9" opacity={0.12} />
                              <line x1={0} y1={traj.farBankY} x2={traj.w} y2={traj.farBankY} stroke="#64748b" strokeWidth={2} />
                              <line x1={0} y1={traj.nearBankY} x2={traj.w} y2={traj.nearBankY} stroke="#64748b" strokeWidth={2} />
                              <line x1={traj.startX} y1={traj.nearBankY} x2={traj.startX} y2={traj.farBankY} stroke="#475569" strokeWidth={1.5} strokeDasharray="4,4" />
                              <circle cx={traj.startX} cy={traj.nearBankY} r={4} fill="#e2e8f0" />
                              {traj.river.canCross && (
                                <>
                                  <SvgArrow x1={traj.startX} y1={traj.nearBankY} x2={traj.landingX} y2={traj.farBankY} color="#34d399" width={2} dashed />
                                  <circle cx={traj.landingX} cy={traj.farBankY} r={4} fill="#34d399" />
                                </>
                              )}
                            </svg>
                            <div className="text-[10px] text-gray-400 text-center mt-1">
                              top-down view — dashed line = straight-across aim
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="bg-slate-900/60 rounded-lg p-3 text-xs font-mono space-y-1">
                      <div>Ground velocity: ({river.groundVec.x.toFixed(2)}, {river.groundVec.y.toFixed(2)}) m/s</div>
                      <div>Ground speed: {river.groundSpeed.toFixed(2)} m/s at {toDisplayAngle(river.groundAngle).toFixed(1)}°</div>
                      {river.canCross ? (
                        <>
                          <div className="text-emerald-400">Crossing time: {river.crossTime.toFixed(1)} s</div>
                          <div className={Math.abs(river.drift) < 0.5 ? 'text-emerald-400' : 'text-yellow-400'}>
                            Downstream drift: {river.drift.toFixed(1)} m
                          </div>
                        </>
                      ) : (
                        <div className="text-red-400">This heading gives zero (or negative) across-river progress — the boat never reaches the far bank.</div>
                      )}
                      {showWorking && (
                        <div className="pt-1 border-t border-slate-600/60 text-gray-400">
                          <div>Vboat = ({river.boatVec.x.toFixed(2)}, {river.boatVec.y.toFixed(2)}) m/s</div>
                          <div>Vground = Vcurrent + Vboat = ({currentSpeed.toFixed(1)} + {river.boatVec.x.toFixed(2)}, 0 + {river.boatVec.y.toFixed(2)})</div>
                          {river.canCross && <div>t = width / Vground,y = {riverWidth} / {river.groundVec.y.toFixed(2)} = {river.crossTime.toFixed(1)} s</div>}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={solveZeroDrift}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg text-sm font-semibold transition-all"
                    >
                      Solve heading for zero drift
                    </button>
                    <button
                      onClick={() => setRiverMode(false)}
                      className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm transition-all"
                    >
                      Exit River Lab
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Added: Equilibrium (three-force) lab */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-xl font-bold mb-4 text-orange-400 flex items-center gap-2">
                <Scale size={20} /> Equilibrium Lab
              </h2>
              {!equilibriumMode ? (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    Two forces are given. Find the magnitude and angle of the third
                    force that brings the net force to zero.
                  </p>
                  <button
                    onClick={generateEquilibriumProblem}
                    className="w-full bg-orange-600 hover:bg-orange-500 py-3 rounded-lg font-semibold transition-all"
                  >
                    New Problem
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="bg-slate-900/60 rounded-lg p-3 text-xs font-mono space-y-1">
                    <div>F1 = {eqForces.f1.V} units at {toDisplayAngle(eqForces.f1.theta).toFixed(1)}°</div>
                    <div>F2 = {eqForces.f2.V} units at {toDisplayAngle(eqForces.f2.theta).toFixed(1)}°</div>
                  </div>

                  {/* Added: force-triangle diagram. F1 then F2 tail-to-tip from the
                      origin; your guess (grey/green/red) and, once revealed, the
                      true solution (dashed emerald) both drawn as the closing leg —
                      a correct answer visibly closes the triangle back on the origin. */}
                  {(() => {
                    const diag = getEquilibriumDiagram();
                    const guessColor = !eqFeedback ? '#94a3b8' : (eqFeedback.correct ? '#34d399' : '#f87171');
                    return (
                      <div className="bg-slate-900/40 rounded-lg p-2">
                        <svg viewBox={`0 0 ${diag.w} ${diag.h}`} className="w-full h-auto max-w-[220px] mx-auto block">
                          <SvgArrow x1={diag.O.x} y1={diag.O.y} x2={diag.tip1.x} y2={diag.tip1.y} color="#38bdf8" />
                          <SvgArrow x1={diag.tip1.x} y1={diag.tip1.y} x2={diag.tip2.x} y2={diag.tip2.y} color="#fbbf24" />
                          {diag.guessTipScreen && (
                            <SvgArrow x1={diag.tip2.x} y1={diag.tip2.y} x2={diag.guessTipScreen.x} y2={diag.guessTipScreen.y} color={guessColor} width={2} />
                          )}
                          {eqSolved && (
                            <SvgArrow x1={diag.tip2.x} y1={diag.tip2.y} x2={diag.solTipScreen.x} y2={diag.solTipScreen.y} color="#34d399" width={2} dashed />
                          )}
                          <circle cx={diag.O.x} cy={diag.O.y} r={4} fill="#e2e8f0" />
                        </svg>
                        <div className="text-[10px] text-gray-400 text-center mt-1 space-x-2">
                          <span className="text-sky-400">■ F1</span>
                          <span className="text-amber-400">■ F2</span>
                          <span style={{ color: guessColor }}>■ your F3</span>
                          {eqSolved && <span className="text-emerald-400">■ true F3</span>}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-gray-400">
                      F3 magnitude
                      <input
                        type="number" step="0.1" value={eqGuess.V}
                        onChange={(e) => setEqGuess({ ...eqGuess, V: e.target.value })}
                        className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="?"
                      />
                    </label>
                    <label className="text-xs text-gray-400">
                      F3 angle ({angleUnitLabel})
                      <input
                        type="number" step="1" value={eqGuess.theta}
                        onChange={(e) => setEqGuess({ ...eqGuess, theta: e.target.value })}
                        className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        placeholder="?"
                      />
                    </label>
                  </div>

                  {eqFeedback && (
                    <div className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
                      eqFeedback.correct ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'
                    }`}>
                      {eqFeedback.correct ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                      <span>{eqFeedback.message}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={checkEquilibriumGuess}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg text-sm font-semibold transition-all"
                    >
                      Check
                    </button>
                    <button
                      onClick={() => setEqSolved(!eqSolved)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-semibold transition-all"
                    >
                      {eqSolved ? 'Hide' : 'Reveal'} Solution
                    </button>
                  </div>

                  {eqSolved && (() => {
                    const sol = getEquilibriumSolution();
                    return (
                      <div className="text-xs font-mono text-gray-300 bg-slate-900/60 rounded-lg p-3 space-y-1">
                        <div>ΣF (F1+F2) = ({sol.sumX.toFixed(2)}, {sol.sumY.toFixed(2)})</div>
                        <div>F3 = −ΣF = ({sol.f3x.toFixed(2)}, {sol.f3y.toFixed(2)})</div>
                        <div>|F3| = {sol.f3V.toFixed(2)}, angle = {toDisplayAngle(sol.f3theta).toFixed(1)}°</div>
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => {
                      setEquilibriumMode(false);
                      setEqFeedback(null);
                    }}
                    className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm transition-all"
                  >
                    Exit Equilibrium Lab
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4 text-cyan-400 flex items-center gap-2">
            <BookOpen size={20} /> How to Use
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🖱️ Drag Vectors</h3>
              <p className="text-gray-300">
                Click and drag the arrow tips to adjust vector magnitude and direction.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">➕ Add/Remove</h3>
              <p className="text-gray-300">
                Add new vectors or delete existing ones using the control panel.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🔄 Switch Methods</h3>
              <p className="text-gray-300">
                Toggle between tail-to-tip and parallelogram visualization methods.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🎯 Challenge Mode</h3>
              <p className="text-gray-300">
                Test your skills by creating vectors that reach the target point!
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🧮 Magnitude/Angle + Show Working</h3>
              <p className="text-gray-300">
                Edit a vector's magnitude and angle directly, and toggle "Show Working" to see the
                Vx = V·cos(θ), Vy = V·sin(θ) substitution for every vector and the resultant.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🧠 Component Practice</h3>
              <p className="text-gray-300">
                Given V and θ, predict Vx and Vy yourself before checking — feedback calls out
                sign errors by quadrant instead of just marking you wrong.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🧭 Angle Convention</h3>
              <p className="text-gray-300">
                Switch every angle field in the app between standard math angle (° CCW from +x)
                and compass bearing (° CW from North) — the underlying vector doesn't change,
                only how its angle is read and entered.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">🌊 Relative Velocity Lab</h3>
              <p className="text-gray-300">
                Combine a river current with a boat's velocity to find ground speed, crossing
                time, and downstream drift — or solve directly for the heading that cancels drift.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-emerald-400 mb-2">⚖️ Equilibrium Lab</h3>
              <p className="text-gray-300">
                Given two forces, find the third that zeroes the net force. Check your own
                answer against the residual, or reveal the worked solution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VectorAdditionPlayground;
