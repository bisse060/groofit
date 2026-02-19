import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Send, Sparkles, Dumbbell, Moon, TrendingUp, ChevronRight, Bot, User, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: { proactive?: boolean; routineId?: string; routineTitle?: string };
  created_at?: string;
}

const QUICK_ACTIONS = [
  { label: 'Analyseer mijn vorige week', icon: TrendingUp },
  { label: 'Maak een trainingsschema voor mij', icon: Dumbbell },
  { label: 'Geef me slaaptips', icon: Moon },
  { label: 'Hoe kan ik progressie maken op mijn bench?', icon: TrendingUp },
];

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-3 mb-1">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export default function Coach() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showRoutineDialog, setShowRoutineDialog] = useState(false);
  const [routineInput, setRoutineInput] = useState('');
  const [isGeneratingRoutine, setIsGeneratingRoutine] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_coach_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const loadedMessages: Message[] = (data || []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        metadata: (m.metadata as any) || {},
        created_at: m.created_at || undefined,
      }));

      setMessages(loadedMessages);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string, metadata?: { [key: string]: string | boolean | number | null }) => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('ai_coach_messages')
      .insert([{ user_id: user.id, role, content, metadata: metadata ?? {} }])
      .select()
      .single();
    return data?.id;
  };

  // Detect if user message is asking for a routine
  const isRoutineRequest = (text: string) => {
    const keywords = ['schema', 'routine', 'trainingschema', 'trainingsplan', 'workout plan', 'programma', 'push pull', 'full body', 'upper lower', 'ppl'];
    const lower = text.toLowerCase();
    return keywords.some(k => lower.includes(k));
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Save user message
    await saveMessage('user', text);

    // Build conversation history for AI (last 20 messages)
    const historyForAI = [...messages, userMsg].slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let assistantContent = '';
    const assistantId = crypto.randomUUID();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'chat', messages: historyForAI }),
      });

      if (resp.status === 429) {
        toast({ title: 'Te veel verzoeken', description: 'Probeer het over een moment opnieuw.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: 'Onvoldoende credits', description: 'Voeg credits toe aan je workspace.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error('Stream mislukt');

      // Add placeholder
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              assistantContent += chunk;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      await saveMessage('assistant', assistantContent);

      // If user asked for a routine, automatically open the routine dialog
      if (isRoutineRequest(text) && assistantContent.length > 0) {
        setRoutineInput(text);
        setShowRoutineDialog(true);
      }
    } catch (err) {
      console.error('Chat error:', err);
      toast({ title: 'Fout', description: 'Er is een fout opgetreden. Probeer het opnieuw.', variant: 'destructive' });
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  };

  const generateRoutine = async () => {
    if (!routineInput.trim() || isGeneratingRoutine) return;
    setIsGeneratingRoutine(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'generate-routine',
          routineName: routineInput,
        }),
      });

      const result = await resp.json();

      if (!resp.ok || !result.success) {
        throw new Error(result.error || 'Fout bij aanmaken schema');
      }

      setShowRoutineDialog(false);
      setRoutineInput('');

      // Add assistant message with routine info
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `✅ ${result.message || `Je trainingschema "${result.routineTitle}" is aangemaakt met ${result.exerciseCount} oefeningen.`} Je kunt het nu bekijken en aanpassen.`,
        metadata: { routineId: result.routineId, routineTitle: result.routineTitle },
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage('assistant', assistantMsg.content, { routineId: result.routineId, routineTitle: result.routineTitle });

      toast({
        title: '🎉 Schema aangemaakt!',
        description: `"${result.routineTitle}" staat klaar in je Routines. Klik op "Bekijk routine" in het chatbericht om het te openen.`,
      });
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message || 'Schema aanmaken mislukt', variant: 'destructive' });
    } finally {
      setIsGeneratingRoutine(false);
    }
  };

  const handleQuickAction = (label: string) => {
    if (label === 'Maak een trainingsschema voor mij') {
      setShowRoutineDialog(true);
    } else {
      sendMessage(label);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const showQuickActions = messages.length === 0 && !isLoadingHistory;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-7rem)] max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">AI Coach</h1>
            <p className="text-xs text-muted-foreground">Persoonlijk fitnessadvies op basis van jouw data</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isLoadingHistory && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {showQuickActions && (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Hoi! Ik ben je AI Coach</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Ik ken jouw trainingen, metingen en slaapdata. Stel me gerust een vraag!
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 mt-4">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.label)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
                    >
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{action.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-foreground transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-end">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}
              >
                {msg.metadata?.proactive && (
                  <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border/30">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-primary">Coach tip van deze week</span>
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                ) : (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                )}
                {msg.metadata?.routineId && (
                  <button
                    onClick={() => navigate(`/routines/${msg.metadata!.routineId}`)}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors w-full"
                  >
                    <Dumbbell className="h-4 w-4" />
                    <span className="text-sm font-medium">Bekijk routine</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </button>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex items-end">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex items-end">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/50 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stel een vraag aan je coach..."
              className="min-h-[44px] max-h-32 resize-none rounded-xl text-sm"
              disabled={isLoading}
              rows={1}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Enter = versturen · Shift+Enter = nieuwe regel
          </p>
        </div>
      </div>

      {/* Routine Generator Dialog */}
      {showRoutineDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowRoutineDialog(false)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <button
              onClick={() => setShowRoutineDialog(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <Dumbbell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Trainingschema genereren</h2>
                <p className="text-sm text-muted-foreground">De AI maakt een schema op basis van jouw data</p>
              </div>
            </div>
            <Textarea
              value={routineInput}
              onChange={(e) => setRoutineInput(e.target.value)}
              placeholder="Beschrijf wat je wil, bijv. 'Push/Pull/Legs schema voor spiermassa' of '3-daags full body schema'"
              className="mb-4 resize-none"
              rows={4}
              disabled={isGeneratingRoutine}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRoutineDialog(false)} className="flex-1" disabled={isGeneratingRoutine}>
                Annuleren
              </Button>
              <Button onClick={generateRoutine} className="flex-1" disabled={!routineInput.trim() || isGeneratingRoutine}>
                {isGeneratingRoutine ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Genereren...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Schema maken
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
