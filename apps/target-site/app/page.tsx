"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const fakeProducts = [
  {
    name: "Noise-Cancelling Headphones",
    price: "$129",
    description: "Great reviews, buried behind popups.",
  },
  {
    name: "Portable AI Dev Kit",
    price: "$249",
    description: "Popular item, but the page is hostile to agents.",
  },
  {
    name: "USB-C Travel Hub",
    price: "$39",
    description: "Cheap and useful, if the agent can find it.",
  },
];

const annoyingMessages = [
  "Congratulations! You are visitor #404!",
  "Limited time offer! This button does nothing!",
  "Your attention is required for no good reason.",
  "PopUpMart wants to send you imaginary rewards.",
  "Wait! Before you continue, consider this useless message.",
  "Human verification level 2: close this popup manually.",
  "Exclusive deal unlocked! Not really.",
  "Important notice: this notice is not important.",
  "You have won one free inconvenience.",
  "Almost there! Just close seven more windows.",
];

type AnnoyingPopup = {
  id: number;
  message: string;
  top: number;
  left: number;
  rotate: number;
};

type PopupStyle = CSSProperties & {
  "--popup-rotate": string;
};

export default function HumanOnlyTargetSite() {
  const [showCookie, setShowCookie] = useState(true);
  const [showNewsletter, setShowNewsletter] = useState(true);
  const [humanChecked, setHumanChecked] = useState(false);
  const [annoyingPopups, setAnnoyingPopups] = useState<AnnoyingPopup[]>([]);
  const [annoyanceEnabled, setAnnoyanceEnabled] = useState(true);
  const [isDissipating, setIsDissipating] = useState(false);

  const popupIdRef = useRef(1);
  const dissipateTimeoutRef = useRef<number | null>(null);

  const closeAnnoyingPopup = useCallback((id: number) => {
    setAnnoyingPopups((current) =>
      current.filter((popup) => popup.id !== id)
    );
  }, []);

  const dissipatePopups = useCallback(() => {
    setAnnoyanceEnabled(false);
    setIsDissipating(true);

    if (dissipateTimeoutRef.current) {
      window.clearTimeout(dissipateTimeoutRef.current);
    }

    dissipateTimeoutRef.current = window.setTimeout(() => {
      setAnnoyingPopups([]);
      setIsDissipating(false);
      dissipateTimeoutRef.current = null;
    }, 450);
  }, []);

  const restartPopups = useCallback(() => {
    if (dissipateTimeoutRef.current) {
      window.clearTimeout(dissipateTimeoutRef.current);
      dissipateTimeoutRef.current = null;
    }

    setAnnoyingPopups([]);
    setIsDissipating(false);
    setAnnoyanceEnabled(true);
  }, []);

  useEffect(() => {
    if (!annoyanceEnabled) return;

    const createPopup = () => {
      setAnnoyingPopups((current) => {
        if (current.length >= 12) return current;

        const popup: AnnoyingPopup = {
          id: popupIdRef.current++,
          message:
            annoyingMessages[
              Math.floor(Math.random() * annoyingMessages.length)
            ],
          top: Math.floor(Math.random() * 70) + 8,
          left: Math.floor(Math.random() * 70) + 8,
          rotate: Math.floor(Math.random() * 12) - 6,
        };

        return [...current, popup];
      });
    };

    createPopup();
    createPopup();
    createPopup();

    const interval = window.setInterval(createPopup, 1400);

    return () => window.clearInterval(interval);
  }, [annoyanceEnabled]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dissipatePopups();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      if (dissipateTimeoutRef.current) {
        window.clearTimeout(dissipateTimeoutRef.current);
      }
    };
  }, [dissipatePopups]);

  return (
    <main className="page">
      <section className="container">
        <div className="card">
          <span className="badge">Mock human-only website</span>
          <h1 className="title">PopUpMart</h1>
          <p className="subtitle">
            This demo site is deliberately awkward for AI agents: cookie banners,
            newsletter modals, confusing buttons, blurred product cards, and a
            manual human check. Verified agents should use the cryptographic
            agent lane instead.
          </p>

          <div className="button-row">
            <a
              className="btn primary"
              href="/.well-known/agent-access.json"
              target="_blank"
            >
              View agent access manifest
            </a>
            <a className="btn" href="/api/agent/products" target="_blank">
              Try raw agent API without headers
            </a>
          </div>
        </div>

        <div className="section grid grid-3 product-grid">
          {fakeProducts.map((product) => (
            <article key={product.name} className="card">
              <h2 className="product-title">{product.name}</h2>
              <p className="muted">{product.price}</p>
              <p className="muted">{product.description}</p>
              <button
                className="btn yellow"
                onClick={() => alert("Wrong button. Human web is ambiguous.")}
              >
                Click here maybe?
              </button>
            </article>
          ))}
        </div>

        <div className="section card human-check">
          <h2>Human check</h2>
          <p className="muted">
            Please confirm you are not an autonomous software agent.
          </p>

          <label
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginTop: 16,
            }}
          >
            <input
              type="checkbox"
              checked={humanChecked}
              onChange={(event) => setHumanChecked(event.target.checked)}
            />
            <span>I am a human clicking this box manually.</span>
          </label>

          <button
            className="btn primary"
            disabled={!humanChecked}
            style={{ marginTop: 16 }}
          >
            Continue as human
          </button>
        </div>

        <div className="section card green-card">
          <h2>Verified agent lane</h2>
          <p className="muted">
            Verified agents should not scrape this page. They should discover the
            manifest, sign a scoped request, and call the machine-readable API.
          </p>
          <pre>{`GET /.well-known/agent-access.json
GET /api/agent/products

Required proof:
- x-agent-address
- x-agent-passport-id
- x-agent-chain-id
- x-agent-domain
- x-agent-path
- x-agent-intent
- x-agent-nonce
- x-agent-deadline
- x-agent-signature`}</pre>
        </div>
      </section>

      {showCookie && (
        <aside className="popup card">
          <h2>Cookie Preferences</h2>
          <p className="muted">
            We use 47 categories of cookies. Please configure each option before
            reading public product data.
          </p>
          <div className="button-row">
            <button className="btn" onClick={() => setShowCookie(false)}>
              Reject maybe
            </button>
            <button
              className="btn yellow"
              onClick={() => alert("Still wrong.")}
            >
              Click here
            </button>
          </div>
        </aside>
      )}

      {showNewsletter && (
        <div className="modal-backdrop">
          <div className="modal card">
            <h2>Wait!</h2>
            <p className="muted">
              Subscribe to our newsletter before reading product data.
            </p>
            <input className="input" placeholder="human@email.com" />

            <div className="button-row">
              <button
                className="btn primary"
                onClick={() => alert("Thanks, human.")}
              >
                Subscribe
              </button>
              <button className="btn" onClick={() => setShowNewsletter(false)}>
                tiny hidden close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="demo-controls card">
        <strong>Demo controls</strong>
        <p className="muted">Press Escape to dissipate popups instantly.</p>

        <div className="button-row">
          <button className="btn primary" onClick={dissipatePopups}>
            Dissipate popups
          </button>

          <button className="btn" onClick={restartPopups}>
            Restart annoyance
          </button>
        </div>
      </div>

      {annoyingPopups.map((popup) => {
        const popupStyle: PopupStyle = {
          top: `${popup.top}%`,
          left: `${popup.left}%`,
          transform: `rotate(${popup.rotate}deg)`,
          "--popup-rotate": `${popup.rotate}deg`,
        };

        return (
          <aside
            key={popup.id}
            className={`annoying-popup card ${
              isDissipating ? "dissipating" : ""
            }`}
            style={popupStyle}
          >
            <div className="annoying-header">
              <strong>Totally Real Alert</strong>
              <button
                className="annoying-x"
                onClick={() => closeAnnoyingPopup(popup.id)}
                aria-label="Close popup"
              >
                ×
              </button>
            </div>

            <p className="muted">{popup.message}</p>

            <div className="button-row">
              <button
                className="btn yellow"
                onClick={() => alert("This fake offer has expired already.")}
              >
                Claim now
              </button>
              <button
                className="btn tiny-button"
                onClick={() => closeAnnoyingPopup(popup.id)}
              >
                no thanks
              </button>
            </div>
          </aside>
        );
      })}

      <style jsx global>{`
        .demo-controls {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 120;
          width: 280px;
        }

        .annoying-popup {
          position: fixed;
          width: 280px;
          z-index: 80;
          animation: annoying-wiggle 0.45s infinite alternate ease-in-out;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        }

        .annoying-popup.dissipating {
          animation: dissipate-away 0.45s ease-in forwards;
          pointer-events: none;
        }

        .annoying-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .annoying-x {
          border: 0;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          background: #111;
          color: white;
        }

        .tiny-button {
          font-size: 10px;
          opacity: 0.65;
          transform: scale(0.85);
        }

        @keyframes annoying-wiggle {
          from {
            margin-top: -3px;
            margin-left: -2px;
          }

          to {
            margin-top: 3px;
            margin-left: 2px;
          }
        }

        @keyframes dissipate-away {
          from {
            opacity: 1;
            transform: scale(1) rotate(var(--popup-rotate, 0deg));
            filter: blur(0);
          }

          to {
            opacity: 0;
            transform: scale(0.75) translateY(-20px)
              rotate(var(--popup-rotate, 0deg));
            filter: blur(8px);
          }
        }
      `}</style>
    </main>
  );
}