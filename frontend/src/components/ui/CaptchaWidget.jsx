// src/components/ui/CaptchaWidget.jsx
import { useState, forwardRef, useImperativeHandle } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

function MathCaptcha({ onChange }) {
  const [a]      = useState(() => Math.floor(Math.random() * 9) + 1);
  const [b]      = useState(() => Math.floor(Math.random() * 9) + 1);
  const [answer, setAnswer] = useState('');

  const check = (val) => {
    setAnswer(val);
    onChange(parseInt(val) === a + b ? 'math_ok' : null);
  };

  return (
    <div className="rounded-xl bg-gray-800/60 border border-gray-700 px-4 py-3">
      <p className="text-sm font-semibold text-gray-300 mb-2">
        Security check: What is{' '}
        <span className="text-emerald-400 font-black">{a} + {b}</span>?
      </p>
      <input
        type="number"
        className="input py-2 text-sm"
        placeholder="Enter answer"
        value={answer}
        onChange={e => check(e.target.value)}
      />
    </div>
  );
}

const CaptchaWidget = forwardRef(function CaptchaWidget({ onSuccess }, ref) {
  const innerRef = { current: null };

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (SITE_KEY && innerRef.current?.reset) innerRef.current.reset();
    },
    getValue: () => {
      if (SITE_KEY && innerRef.current?.getValue) return innerRef.current.getValue();
      return 'math_ok';
    },
  }));

  if (SITE_KEY) {
    return (
      <div className="flex justify-center py-2">
        <ReCAPTCHA
          ref={innerRef}
          sitekey={SITE_KEY}
          theme="dark"
          onChange={(token) => onSuccess(!!token)}
          onExpired={() => onSuccess(false)}
        />
      </div>
    );
  }

  return <MathCaptcha onChange={(val) => onSuccess(!!val)} />;
});

export default CaptchaWidget;
