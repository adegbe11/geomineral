"use client";
import { useState } from "react";
import {
  Search as SearchIcon,
  ArrowUpRight,
  MapPin,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Location } from "@/lib/types";
export default function Search({
  select,
}: {
  select: (location: Location) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    setSearched(false);
    try {
      setResults(
        await api<Location[]>(`/search?q=${encodeURIComponent(query)}`),
      );
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="search-wrap">
      <form className="search" onSubmit={search}>
        <SearchIcon size={20} />
        <input
          aria-label="Search any location"
          placeholder="Search a place, address, or coordinates"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(false);
            setResults([]);
          }}
        />
        <button aria-label="Search" disabled={busy}>
          {busy ? (
            <Loader2 className="spin" size={20} />
          ) : (
            <ArrowUpRight size={21} />
          )}
        </button>
      </form>
      {(results.length > 0 || error || searched) && (
        <div className="search-results">
          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => {
                select(result);
                setQuery(result.name.split(",").slice(0, 2).join(","));
                setResults([]);
                setSearched(false);
              }}
            >
              <MapPin size={17} />
              <span>{result.name}</span>
              <ArrowUpRight size={16} />
            </button>
          ))}
          {error && <p role="alert">{error}</p>}
          {searched && results.length === 0 && (
            <p>No matching place found. Try latitude, longitude.</p>
          )}
          <small>Place search © OpenStreetMap contributors</small>
        </div>
      )}
    </div>
  );
}
