import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, RotateCcw, Target, BookOpen, Award, Eye, EyeOff,
  Calculator, Brain, CheckCircle2, XCircle, ArrowRight
} from 'lucide-react';

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

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const ORIGIN_X = CANVAS_WIDTH / 2;
  const ORIGIN_Y = CANVAS_HEIGHT / 2;
  const PIXELS_PER_UNIT = 20;

  // Generate challenge
  const generateChallenge = () => {
    const targetX = Math.floor(Math.random() * 10 - 5) * 20;
    const targetY = Math.floor(Math.random() * 10 - 5) * 20;
    setChallenge({ x: targetX, y: targetY });
    setVectors([]);
    setNextId(1);
    setChallengeMode(true);
  };

  // Check challenge completion
  const checkChallenge = () => {
    if (!challenge) return;
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

  // --- Added: Cartesian <-> polar helpers ---
  // theta is returned in degrees, standard math convention (CCW from +x axis), range [0, 360).
  const getPolar = (v) => {
    const V = Math.sqrt(v.x * v.x + v.y * v.y);
    let theta = Math.atan2(v.y, v.x) * 180 / Math.PI;
    if (theta < 0) theta += 360;
    return { V, theta };
  };

  const setVectorMagnitude = (id, newV) => {
    if (Number.isNaN(newV)) return;
    setVectors(vectors.map(v => {
      if (v.id !== id) return v;
      const { theta } = getPolar(v);
      const rad = theta * Math.PI / 180;
      return { ...v, x: newV * Math.cos(rad), y: newV * Math.sin(rad) };
    }));
  };

  const setVectorAngle = (id, newTheta) => {
    if (Number.isNaN(newTheta)) return;
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
      setPracticeFeedback({ correct: false, message: `Magnitude of Vx is right, but the sign is wrong — which side of the y-axis does ${theta}° put you on?` });
    } else if (vySignFlip && vxOk) {
      setPracticeFeedback({ correct: false, message: `Magnitude of Vy is right, but the sign is wrong — is ${theta}° above or below the x-axis?` });
    } else if (vxSignFlip && vySignFlip) {
      setPracticeFeedback({ correct: false, message: `Both magnitudes are right, but check your signs — which quadrant is ${theta}° actually in?` });
    } else {
      setPracticeFeedback({ correct: false, message: `Not quite. Recompute Vx = V cos(θ) and Vy = V sin(θ) with V = ${V} and θ = ${theta}°.` });
    }
  };

  const addVector = () => {
    const newVector = {
      id: nextId,
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
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
    for (const vector of vectors) {
      const endX = ORIGIN_X + vector.x * scale;
      const endY = ORIGIN_Y - vector.y * scale;
      const distance = Math.sqrt(Math.pow(mouseX - endX, 2) + Math.pow(mouseY - endY, 2));
      
      if (distance < 25) {
        setDragging(vector.id);
        e.preventDefault();
        break;
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const newX = (mouseX - ORIGIN_X) / scale;
    const newY = -(mouseY - ORIGIN_Y) / scale;
    
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

    for (const vector of vectors) {
      const endX = ORIGIN_X + vector.x * scale;
      const endY = ORIGIN_Y - vector.y * scale;
      const distance = Math.sqrt(Math.pow(mouseX - endX, 2) + Math.pow(mouseY - endY, 2));
      
      if (distance < 25) {
        setDragging(vector.id);
        e.preventDefault();
        break;
      }
    }
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
    
    const newX = (mouseX - ORIGIN_X) / scale;
    const newY = -(mouseY - ORIGIN_Y) / scale;
    
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
                <button
                  onClick={addVector}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add Vector
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
                          Angle (° from +x)
                          <input
                            type="number"
                            step="1"
                            value={theta.toFixed(1)}
                            onChange={(e) => setVectorAngle(vector.id, parseFloat(e.target.value))}
                            className="w-full mt-1 bg-slate-900/60 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                          />
                        </label>
                      </div>

                      {/* Added: "show working" breakdown of the component resolution */}
                      {showWorking && (
                        <div className="mt-2 pt-2 border-t border-slate-600/60 text-xs font-mono text-gray-300 space-y-0.5">
                          <div>Vx = V·cos(θ) = {V.toFixed(1)}·cos({theta.toFixed(1)}°) = {(V * Math.cos(rad)).toFixed(1)}</div>
                          <div>Vy = V·sin(θ) = {V.toFixed(1)}·sin({theta.toFixed(1)}°) = {(V * Math.sin(rad)).toFixed(1)}</div>
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
                    {resultantAngle.toFixed(1)}°
                  </span>
                </div>
                {/* Added: show working for the resultant magnitude/angle */}
                {showWorking && (
                  <div className="mt-2 pt-2 border-t border-slate-600/60 text-xs font-mono text-gray-400 space-y-0.5">
                    <div>|R| = √(Rx² + Ry²) = √({resultant.x.toFixed(1)}² + {resultant.y.toFixed(1)}²) = {resultantMag.toFixed(1)}</div>
                    <div>θ = atan2(Ry, Rx) = atan2({resultant.y.toFixed(1)}, {resultant.x.toFixed(1)}) = {resultantAngle.toFixed(1)}°</div>
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
                      Create vectors that result in the target (🎯) location!
                    </p>
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
                        V = {practiceQuestion.V} units, θ = {practiceQuestion.theta}°
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default VectorAdditionPlayground;
