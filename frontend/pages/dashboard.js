import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";

const MOCK_SESSIONS = [
  { id: "s1", date: "2026-02-25", score: 28, bucket: "Low",      quality: "Good"  },
  { id: "s2", date: "2026-02-20", score: 41, bucket: "Moderate", quality: "Good"  },
  { id: "s3", date: "2026-02-14", score: 35, bucket: "Low",      quality: "Noisy" },
];

const bucketColor = { Low: "#21E6C1", Moderate: "#F7CC3B", High: "#EF4444" };
const bucketBg    = { Low: "rgba(33,230,193,0.1)", Moderate: "rgba(247,204,59,0.1)", High: "rgba(239,68,68,0.1)" };

export default function Dashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setTimeout(() => { setSessions(MOCK_SESSIONS); setLoading(false); }, 600);
  }, []);

  const latest = sessions[0];

  return (
    <>
      <Head>
        <title>Dashboard — Voxidria</title>
      </Head>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --navy:  #1A2E44;
          --green: #21E6C1;
          --lime:  #A4FF00;
          --slate: #F9FAFB;
          --white: #FFFFFF;
          --muted: #6B7280;
          --border:#E5E7EB;
          --danger:#EF4444;
          --warn:  #F7CC3B;
          --font:  'Montserrat', sans-serif;
        }
        html, body { background: var(--slate); color: var(--navy); font-family: var(--font); }

        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { to{background-position:-200% 0;} }
        .fade-up { animation: fadeUp 0.5s ease both; }

        nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 2.5rem; background: var(--white);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 1px 8px rgba(26,46,68,0.06);
        }
        .nav-logo { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
        .nav-logo img, .nav-logo :global(img) { height: 38px; width: auto; }

        .btn {
          padding: 0.5rem 1.2rem; border-radius: 6px; font-family: var(--font);
          font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .btn-outline { background: transparent; border: 1.5px solid var(--border); color: var(--muted); }
        .btn-outline:hover { border-color: var(--navy); color: var(--navy); }
        .btn-primary {
          background: linear-gradient(135deg, var(--navy), var(--green));
          border: none; color: white; font-weight: 700;
          box-shadow: 0 2px 12px rgba(33,230,193,0.2);
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

        main { max-width: 1100px; margin: 0 auto; padding: 2.5rem 2.5rem; }

        .page-title { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0.3rem; color: var(--navy); }
        .page-sub { font-size: 0.85rem; color: var(--muted); font-weight: 400; }

        .stats {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr));
          gap: 1rem; margin: 2rem 0;
        }
        .stat {
          background: var(--white); border: 1px solid var(--border);
          border-radius: 12px; padding: 1.5rem;
          box-shadow: 0 1px 4px rgba(26,46,68,0.05);
        }
        .stat-label { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.5rem; font-weight: 600; }
        .stat-value { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--navy); }
        .stat-sub { font-size: 0.72rem; color: var(--muted); margin-top: 0.4rem; }

        .section-header { display: flex; align-items: center; justify-content: space-between; margin: 2rem 0 1rem; }
        .section-title { font-size: 1rem; font-weight: 700; color: var(--navy); }

        .table-wrap { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--white); box-shadow: 0 1px 4px rgba(26,46,68,0.05); }
        table { width: 100%; border-collapse: collapse; }
        th { background: var(--slate); padding: 0.85rem 1.2rem; text-align: left; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 600; }
        td { padding: 1rem 1.2rem; border-bottom: 1px solid var(--border); font-size: 0.88rem; color: var(--navy); }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(33,230,193,0.03); }

        .bucket-badge {
          display: inline-block; padding: 0.25rem 0.8rem; border-radius: 999px;
          font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700;
        }
        .score-bar-wrap { display: flex; align-items: center; gap: 0.8rem; }
        .score-bar { height: 4px; border-radius: 2px; flex: 1; background: var(--border); overflow: hidden; }
        .score-bar-fill { height: 100%; border-radius: 2px; }

        .empty { text-align: center; padding: 4rem 2rem; }
        .empty h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--navy); }
        .empty p { font-size: 0.82rem; color: var(--muted); }

        .skeleton { background: linear-gradient(90deg, var(--slate) 25%, var(--border) 50%, var(--slate) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; height: 52px; }

        .disclaimer { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 1rem 1.4rem; margin-top: 2rem; font-size: 0.78rem; color: #7f1d1d; line-height: 1.6; }
        .disclaimer strong { font-weight: 700; }
      `}</style>

      <nav>
        <div className="nav-logo" onClick={() => router.push("/")}>
          <Image src="/logo.png" alt="Voxidria" width={132} height={38} />
        </div>
        <div style={{ display:"flex", gap:"0.75rem", alignItems:"center" }}>
          <button className="btn btn-outline" onClick={() => router.push("/")}>Sign Out</button>
          <button className="btn btn-primary" onClick={() => router.push("/record")}>+ New Screening</button>
        </div>
      </nav>

      <main>
        <div className="fade-up">
          <div className="page-title">Your Dashboard</div>
          <div className="page-sub">Voice screening history and risk overview</div>
        </div>

        {!loading && sessions.length > 0 && (
          <div className="stats fade-up">
            <div className="stat">
              <div className="stat-label">Latest Score</div>
              <div className="stat-value" style={{ color: bucketColor[latest.bucket] }}>{latest.score}</div>
              <div className="stat-sub">out of 100 · risk proxy</div>
            </div>
            <div className="stat">
              <div className="stat-label">Risk Level</div>
              <div className="stat-value" style={{ color: bucketColor[latest.bucket], fontSize:"1.5rem" }}>{latest.bucket}</div>
              <div className="stat-sub">Latest screening</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total Screenings</div>
              <div className="stat-value">{sessions.length}</div>
              <div className="stat-sub">All sessions</div>
            </div>
            <div className="stat">
              <div className="stat-label">Average Score</div>
              <div className="stat-value">{Math.round(sessions.reduce((a,s) => a + s.score, 0) / sessions.length)}</div>
              <div className="stat-sub">All-time average</div>
            </div>
          </div>
        )}

        <div className="section-header fade-up">
          <div className="section-title">Screening History</div>
          <button className="btn btn-primary" onClick={() => router.push("/record")}>+ New Screening</button>
        </div>

        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty fade-up">
            <h3>No screenings yet</h3>
            <p>Complete your first voice screening to see results here.</p>
            <button className="btn btn-primary" style={{ marginTop:"1.5rem" }} onClick={() => router.push("/record")}>
              Start First Screening →
            </button>
          </div>
        ) : (
          <div className="table-wrap fade-up">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Risk Score</th>
                  <th>Level</th>
                  <th>Audio Quality</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "var(--muted)", fontSize:"0.82rem" }}>
                      {new Date(s.date).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" })}
                    </td>
                    <td>
                      <div className="score-bar-wrap">
                        <span style={{ fontWeight:700, minWidth:28 }}>{s.score}</span>
                        <div className="score-bar">
                          <div className="score-bar-fill" style={{ width:`${s.score}%`, background: bucketColor[s.bucket] }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="bucket-badge" style={{ color: bucketColor[s.bucket], background: bucketBg[s.bucket] }}>
                        {s.bucket}
                      </span>
                    </td>
                    <td style={{ color: s.quality === "Noisy" ? "var(--warn)" : "var(--muted)", fontSize:"0.82rem" }}>
                      {s.quality}
                    </td>
                    <td>
                      <button className="btn btn-outline" style={{ fontSize:"0.78rem", padding:"0.3rem 0.8rem" }}
                        onClick={() => router.push(`/results?session=${s.id}`)}>
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="disclaimer fade-up">
          ⚠️ <strong>Not a medical diagnosis.</strong> This tool screens for vocal biomarkers only.
          If you are concerned about your health, please consult a healthcare professional.
        </div>
      </main>
    </>
  );
}
