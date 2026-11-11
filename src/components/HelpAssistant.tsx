import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { ArrowUp, BookOpen, HandHeart, Loader2, RotateCcw } from "lucide-react";
import { askHelpAssistant } from "@/lib/help-assistant.functions";
import type { HelpAnswer } from "@/lib/help-assistant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import logoMark from "@/assets/logo-lvdc-mark.png.asset.json";

type Message = { role: "user" | "assistant"; content: string; meta?: Omit<HelpAnswer, "answer"> };

const SUGGESTIONS = [
  "Comment montrer mon Pass Terrain ?",
  "Comment ajouter un chien à mon foyer ?",
  "Comment m'inscrire à une activité ?",
];

/**
 * Assistant du Centre d'aide : répond uniquement à partir des guides que la personne peut lire.
 * Conversation de la session en cours seulement (rien n'est enregistré).
 */
export default function HelpAssistant() {
  const ask = useServerFn(askHelpAssistant);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending, error]);
  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending]);

  const send = async (history: Message[]) => {
    setPending(true);
    setError(null);
    try {
      const res = await ask({
        data: { messages: history.map(({ role, content }) => ({ role, content })) },
      });
      setMessages([
        ...history,
        { role: "assistant", content: res.answer, meta: { covered: res.covered, guides: res.guides } },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'assistant n'a pas pu répondre.");
    } finally {
      setPending(false);
    }
  };

  const submit = (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages(history);
    setInput("");
    void send(history);
  };

  const retry = () => {
    if (messages.at(-1)?.role === "user") void send(messages);
  };

  return (
    <section aria-label="Assistant du Centre d'aide" className="flex flex-col rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logoMark.url} alt="" className="size-9 shrink-0 rounded-full border border-border object-contain p-0.5" />
          <div>
            <h2 className="font-display text-base font-bold">Assistant des guides</h2>
            <p className="text-xs text-muted-foreground">D'après les guides de l'association uniquement.</p>
          </div>
        </div>
        {messages.length ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            aria-label="Nouvelle question"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            disabled={pending}
          >
            <RotateCcw className="size-4 sm:mr-1" aria-hidden />
            <span className="sr-only sm:not-sr-only">Nouvelle question</span>
          </Button>
        ) : null}
      </header>

      <div className="max-h-[60vh] min-h-48 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Posez votre question sur l'utilisation de la plateforme. Par exemple :
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" className="h-auto rounded-full py-1.5 text-left" onClick={() => submit(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="max-w-[95%] space-y-3 text-sm">
              <div className="space-y-2 leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_ul]:list-disc">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.meta?.covered && m.meta.guides.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Pour lire en entier :</span>
                  {m.meta.guides.map((g) => (
                    <Link
                      key={g.id}
                      to="/help"
                      search={{ guide: g.id }}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                    >
                      <BookOpen className="size-3.5" aria-hidden /> {g.title}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/help-requests"
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    <HandHeart className="size-3.5" aria-hidden /> Demander à l'Entraide
                  </Link>
                </div>
              )}
            </div>
          ),
        )}

        {pending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> L'assistant consulte les guides…
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted p-3 text-sm">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={retry}>
              Réessayer
            </Button>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <label htmlFor="help-question" className="sr-only">
          Votre question
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id="help-question"
            ref={inputRef}
            rows={2}
            maxLength={1000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Votre question…"
            className="min-h-11 resize-none"
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={pending || !input.trim()} aria-label="Envoyer la question">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          N'indiquez pas d'informations personnelles : l'assistant n'en a pas besoin. Rien n'est enregistré.
        </p>
      </form>
    </section>
  );
}
