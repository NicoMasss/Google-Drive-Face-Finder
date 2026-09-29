import { ChangeEvent, FormEvent, useMemo, useEffect, useState } from "react";

type SearchResult = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  similarity_score: number;
  match: boolean;
};

type SearchResponse = {
  results?: SearchResult[];
  processed?: number;
  matched?: number;
  failed?: number;
  error?: string;
  nextPageToken?: string | null;
};

type DriveFolder = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

type DriveImage = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

function App() {
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState<string>("");
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const stored = localStorage.getItem("google-authenticated");
    return stored === "true";
  });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [summary, setSummary] = useState({ processed: 0, matched: 0, failed: 0 });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authenticated = params.get("googleAuthenticated") === "1";

    if (authenticated) {
      localStorage.setItem("google-authenticated", "true");
      setIsAuthenticated(true);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("googleAuthenticated");
      window.history.replaceState({}, "", nextUrl.toString());
    }

    const stored = localStorage.getItem("google-authenticated");
    setIsAuthenticated(stored === "true");
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setFolders([]);
      return;
    }

    async function loadFolders() {
      try {
        setLoadingFolders(true);
        const response = await fetch("/api/auth/drive/folders");
        const payload = await response.json();

        if (!response.ok || payload.error) {
          throw new Error(payload.error || "Erro ao carregar pastas do Drive.");
        }

        setFolders(payload.folders ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingFolders(false);
      }
    }

    loadFolders();
  }, [isAuthenticated, folderId]);

  const buildImageUrl = (fileId: string) => `/api/auth/drive/images/${fileId}/download`;
  const buildDownloadUrl = (fileId: string) => `/api/auth/drive/images/${fileId}/download`;
  const matchingResults = results.filter((result) => result.match);

  const referencePreview = useMemo(
    () => (referenceFile ? URL.createObjectURL(referenceFile) : ""),
    [referenceFile]
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setReferenceFile(file);
    setMessage("");
    setError("");
  };

  const connectGoogle = () => {
    try {
      window.location.href = "/api/auth/google";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar com o Google.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!referenceFile) {
      setError("Selecione uma imagem de referência antes de iniciar a busca.");
      return;
    }

    const formData = new FormData();
    formData.append("reference", referenceFile);
    if (folderId.trim()) {
      formData.append("folderId", folderId.trim());
    }

    try {
      setLoading(true);
      setError("");
      setMessage("Buscando imagens parecidas no Google Drive...");

      const response = await fetch("/api/search/drive", {
        method: "POST",
        body: formData
      });

      const payload: SearchResponse = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Erro ao buscar imagens no Drive.");
      }

      setResults(payload.results ?? []);
      setSummary({
        processed: payload.processed ?? 0,
        matched: payload.matched ?? 0,
        failed: payload.failed ?? 0
      });
      setMessage("Busca concluída com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar a busca.");
      setMessage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Google Drive Face Finder</p>
          <h1>Busca por faces em imagens do Drive</h1>
        </div>
        <button className="primary" type="button" onClick={connectGoogle}>
          {isAuthenticated ? "Google conectado" : "Conectar com Google"}
        </button>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>1. Escolha a imagem de referência</h2>
          <form onSubmit={handleSubmit} className="search-form">
            <label className="upload-box">
              <input type="file" accept="image/*" onChange={handleFileChange} />
              <span>{referenceFile ? referenceFile.name : "Selecionar imagem"}</span>
            </label>

            {referencePreview && (
              <img className="preview" src={referencePreview} alt="Imagem de referência" />
            )}

            <label className="field">
              <span>Pasta do Google Drive para procurar</span>
              <select
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
              >
                <option value="">Todas as pastas do Drive</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            {loadingFolders && <p className="status">Carregando pastas...</p>}

            <button className="primary wide" type="submit" disabled={loading || !referenceFile}>
              {loading ? "Buscando..." : "Buscar pessoas parecidas"}
            </button>
          </form>

          {isAuthenticated && (
            <p className="success">Login do Google ativo e mantido nesta sessão.</p>
          )}
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <h2>2. Resultados</h2>
          {matchingResults.length === 0 ? (
            <p className="empty">Nenhuma correspondência encontrada.</p>
          ) : (
            <div className="results-grid">
              {matchingResults.map((result) => (
                <div key={result.id} className="result-thumb-card">
                  <img src={buildImageUrl(result.id)} alt={result.name} className="result-large-thumb" />
                  <div className="result-foot">
                    <span className={result.match ? "match-score" : "no-match-score"}>
                      {(result.similarity_score * 100).toFixed(1)}%
                    </span>
                    <div className="result-actions-mini">
                      <a href={buildImageUrl(result.id)} target="_blank" rel="noreferrer">Abrir</a>
                      <a href={buildDownloadUrl(result.id)} target="_blank" rel="noreferrer" download>Baixar</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="summary">
            <div>
              <label>Processadas</label>
              <strong>{summary.processed}</strong>
            </div>
            <div>
              <label>Correspondências</label>
              <strong>{summary.matched}</strong>
            </div>
            <div>
              <label>Falhas</label>
              <strong>{summary.failed}</strong>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}

export default App;
