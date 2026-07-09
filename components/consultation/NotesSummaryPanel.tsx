import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  ClipboardList,
  Users,
  Save,
  RefreshCw,
  CheckCircle2,
  Copy,
  Send,
  Edit3,
  Bold,
  Italic,
  List,
  Lock,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase, DBConsultationNote, DBConsultationSummary, DBIreOsogbo, DBEbo } from '@/lib/supabase';
import { toast } from 'sonner';

interface NotesSummaryPanelProps {
  consultationId: string;
  outcomeConfirmed: boolean;
  eboConfirmed: boolean;
  outcome: DBIreOsogbo | null;
  ebo: DBEbo | null;
  note: DBConsultationNote | null;
  summary: DBConsultationSummary | null;
  onNoteChange: (note: DBConsultationNote | null) => void;
  onSummaryChange: (summary: DBConsultationSummary | null) => void;
}

async function callNotesSummaryAPI(
  action: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const searchParams = new URLSearchParams({ action, ...params });
  const url = `${supabaseUrl}/functions/v1/app_notes_summary?${searchParams.toString()}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API request failed');
  return data;
}

export default function NotesSummaryPanel({
  consultationId,
  outcomeConfirmed,
  eboConfirmed,
  outcome,
  ebo,
  note,
  summary,
  onNoteChange,
  onSummaryChange,
}: NotesSummaryPanelProps) {
  const [activeTab, setActiveTab] = useState('notes');
  const [noteContent, setNoteContent] = useState(note?.content || '');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(note ? new Date(note.updated_at) : null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(summary?.summary_text || '');
  const [clientSummary, setClientSummary] = useState(summary?.client_summary || '');
  const [generatedFrom, setGeneratedFrom] = useState(summary?.generated_from || null);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingClientSummary, setIsEditingClientSummary] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const noteContentRef = useRef(noteContent);

  // Keep ref in sync
  useEffect(() => {
    noteContentRef.current = noteContent;
  }, [noteContent]);

  // Initialize from props
  useEffect(() => {
    if (note) {
      setNoteContent(note.content);
      setLastSaved(new Date(note.updated_at));
    }
  }, [note]);

  useEffect(() => {
    if (summary) {
      setSummaryText(summary.summary_text);
      setClientSummary(summary.client_summary || '');
      setGeneratedFrom(summary.generated_from);
    }
  }, [summary]);

  // Auto-save notes every 10 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (noteContentRef.current && noteContentRef.current !== (note?.content || '')) {
        saveNotes(noteContentRef.current);
      }
    }, 10000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.content]);

  const saveNotes = useCallback(async (content?: string) => {
    const contentToSave = content || noteContent;
    if (!contentToSave.trim()) return;

    setIsSavingNote(true);
    try {
      const data = await callNotesSummaryAPI('save-notes', 'POST', {
        consultation_id: consultationId,
        content: contentToSave,
        formatted_content: contentToSave,
      });
      onNoteChange(data.note);
      setLastSaved(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save notes';
      toast.error(message);
    } finally {
      setIsSavingNote(false);
    }
  }, [consultationId, noteContent, onNoteChange]);

  const generateSummary = useCallback(async () => {
    setIsGeneratingSummary(true);
    try {
      const data = await callNotesSummaryAPI('generate-summary', 'GET', undefined, {
        consultation_id: consultationId,
      });

      setSummaryText(data.summary_text);
      setClientSummary(data.client_summary);
      setGeneratedFrom(data.generated_from);

      // Auto-save the generated summary
      const saveData = await callNotesSummaryAPI('save-summary', 'POST', {
        consultation_id: consultationId,
        summary_text: data.summary_text,
        client_summary: data.client_summary,
        generated_from: data.generated_from,
      });

      onSummaryChange(saveData.summary);
      toast.success('Summary generated successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate summary';
      toast.error(message);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [consultationId, onSummaryChange]);

  const saveSummaryEdits = useCallback(async () => {
    try {
      const data = await callNotesSummaryAPI('save-summary', 'POST', {
        consultation_id: consultationId,
        summary_text: summaryText,
        client_summary: clientSummary,
        generated_from: generatedFrom,
      });
      onSummaryChange(data.summary);
      setIsEditingSummary(false);
      setIsEditingClientSummary(false);
      toast.info('Summary updated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save summary';
      toast.error(message);
    }
  }, [consultationId, summaryText, clientSummary, generatedFrom, onSummaryChange]);

  const confirmSummary = useCallback(async () => {
    setIsConfirming(true);
    try {
      const data = await callNotesSummaryAPI('confirm-summary', 'POST', {
        consultation_id: consultationId,
      });
      onSummaryChange(data.summary);
      setConfirmDialogOpen(false);
      toast.success('Summary confirmed successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to confirm summary';
      toast.error(message);
    } finally {
      setIsConfirming(false);
    }
  }, [consultationId, onSummaryChange]);

  const copySummary = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard');
  }, []);

  const insertFormatting = useCallback((format: 'bold' | 'italic' | 'list') => {
    const textarea = document.getElementById('notes-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = noteContent.substring(start, end);

    let newText = '';
    switch (format) {
      case 'bold':
        newText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        newText = `*${selectedText || 'italic text'}*`;
        break;
      case 'list':
        newText = `\n- ${selectedText || 'list item'}`;
        break;
    }

    const updatedContent = noteContent.substring(0, start) + newText + noteContent.substring(end);
    setNoteContent(updatedContent);
  }, [noteContent]);

  // Locked state - waiting for earlier steps
  if (!outcomeConfirmed) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Notes & Summary
          </CardTitle>
          <CardDescription>
            Module 2D — Awaiting Ire/Osogbo confirmation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-16 flex items-center justify-center bg-muted/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              ⏳ Complete Ire/Osogbo determination to unlock notes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Notes & Summary
              </CardTitle>
              <CardDescription>
                Record consultation notes and generate structured summary
              </CardDescription>
            </div>
            {summary?.confirmed_at && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Confirmed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="notes" className="flex items-center gap-1">
                <Edit3 className="h-3 w-3" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="client" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Client
              </TabsTrigger>
            </TabsList>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-3 mt-3">
              {/* Formatting toolbar */}
              <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => insertFormatting('bold')}
                  title="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => insertFormatting('italic')}
                  title="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => insertFormatting('list')}
                  title="Bullet List"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <div className="flex-1 text-right">
                  {lastSaved && (
                    <span className="text-xs text-muted-foreground">
                      Last saved: {lastSaved.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Notes editor */}
              <Textarea
                id="notes-editor"
                placeholder="Enter consultation notes here... Supports **bold**, *italic*, and - bullet points"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm resize-y"
              />

              {/* Save button */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Auto-saves every 10 seconds
                </p>
                <Button
                  size="sm"
                  onClick={() => saveNotes()}
                  disabled={isSavingNote || !noteContent.trim()}
                >
                  {isSavingNote ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  Save Now
                </Button>
              </div>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-3 mt-3">
              {!summaryText ? (
                <div className="text-center py-8 space-y-3">
                  <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No summary generated yet. Generate one from the consultation data.
                  </p>
                  <Button
                    onClick={generateSummary}
                    disabled={isGeneratingSummary}
                  >
                    {isGeneratingSummary ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Generate Summary
                  </Button>
                  {!eboConfirmed && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Ebo not yet confirmed — summary will be partial
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary content */}
                  {isEditingSummary ? (
                    <Textarea
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-muted/20 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {summaryText}
                    </div>
                  )}

                  {/* Generated from badges */}
                  {generatedFrom && (
                    <div className="flex flex-wrap gap-1">
                      {generatedFrom.odu && (
                        <Badge variant="outline" className="text-xs">
                          Odu: {generatedFrom.odu.name}
                        </Badge>
                      )}
                      {generatedFrom.outcome && (
                        <Badge variant="outline" className="text-xs">
                          {generatedFrom.outcome.type}: {generatedFrom.outcome.subtype}
                        </Badge>
                      )}
                      {generatedFrom.ebo && (
                        <Badge variant="outline" className="text-xs">
                          Ebo: {generatedFrom.ebo.category}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {isEditingSummary ? (
                      <>
                        <Button size="sm" onClick={saveSummaryEdits}>
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Save Changes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setSummaryText(summary?.summary_text || '');
                          setIsEditingSummary(false);
                        }}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingSummary(true)}>
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={generateSummary} disabled={isGeneratingSummary}>
                          {isGeneratingSummary ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          )}
                          Regenerate
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copySummary(summaryText)}>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy
                        </Button>
                        {!summary?.confirmed_at && (
                          <Button size="sm" onClick={() => setConfirmDialogOpen(true)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Confirm Summary
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Client Version Tab */}
            <TabsContent value="client" className="space-y-3 mt-3">
              {!clientSummary ? (
                <div className="text-center py-8 space-y-3">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Generate a summary first to see the client-friendly version.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      Client-Friendly Version
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Internal notes and ritual details removed
                    </span>
                  </div>

                  {/* Client summary content */}
                  {isEditingClientSummary ? (
                    <Textarea
                      value={clientSummary}
                      onChange={(e) => setClientSummary(e.target.value)}
                      className="min-h-[200px] font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {clientSummary}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {isEditingClientSummary ? (
                      <>
                        <Button size="sm" onClick={saveSummaryEdits}>
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Save Changes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setClientSummary(summary?.client_summary || '');
                          setIsEditingClientSummary(false);
                        }}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingClientSummary(true)}>
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copySummary(clientSummary)}>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy
                        </Button>
                        <Button size="sm" variant="outline" disabled>
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Send to Client Portal
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Preview note */}
                  <p className="text-xs text-muted-foreground italic">
                    💡 "Send to Client Portal" will be available in a future update.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirm Summary Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Consultation Summary</DialogTitle>
            <DialogDescription>
              Are you sure you want to confirm this summary? This marks the consultation summary as finalized.
              You can still edit it after confirmation if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/30 rounded-lg p-3 text-sm max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {summaryText.substring(0, 500)}
            {summaryText.length > 500 && '...'}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSummary} disabled={isConfirming}>
              {isConfirming ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}