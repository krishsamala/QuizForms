import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const clientApiKey = (formData.get('apiKey') as string) || req.headers.get('x-gemini-api-key') || '';
    const extractedTextPayload = formData.get('extractedText') as string | null;

    if (!file && !extractedTextPayload) {
      return NextResponse.json({ error: 'No PDF file or text content provided' }, { status: 400 });
    }

    const apiKey = clientApiKey.trim() || process.env.GEMINI_API_KEY || '';

    // If API Key is provided, use Gemini AI
    if (apiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        let contents: any[] = [];

        if (file) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const base64Data = buffer.toString('base64');
          contents = [
            {
              role: 'user',
              parts: [
                {
                  text: `You are an expert exam parser and OCR processor.
Analyze the provided Question Paper / Practice Exam PDF thoroughly.

PDF Content Characteristics to handle:
1. Multi-column question layouts.
2. Questions with figures, geometry diagrams, graphs, circuits, or schematics.
3. Answer keys and explanations that may appear on the last pages or interleaved after each question.
4. Extract EVERY question accurately.

Instructions:
- Extract all questions into a JSON array.
- For each question:
  - "num": integer question number (1, 2, 3...)
  - "question": full question text without the option choices.
  - "options": exactly 4 strings for choices (A, B, C, D without the leading A/B/C/D markers).
  - "answer": integer 1, 2, 3, or 4 indicating the correct choice (1 for A, 2 for B, 3 for C, 4 for D). If not found in answer key, default to 1 and flag warning.
  - "points": integer point value (default 1).
  - "explanation": explanation or solution text if provided anywhere in the PDF, otherwise empty string.
  - "hasDiagram": boolean true if the question refers to a figure, diagram, circuit, table, or graph that needs to be visually cropped.
  - "pageNumber": 1-based page number where the question / diagram appears in the PDF.
  - "warning": string describing any formatting issue or null.

Return ONLY valid JSON with this exact structure:
{
  "totalPages": number,
  "warnings": [string],
  "questions": [
    {
      "num": number,
      "question": string,
      "options": [string, string, string, string],
      "answer": number,
      "points": number,
      "explanation": string,
      "hasDiagram": boolean,
      "pageNumber": number,
      "warning": string | null
    }
  ]
}`
                },
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data,
                  },
                },
              ],
            },
          ];
        } else {
          // Extracted text fallback for Gemini
          contents = [
            {
              role: 'user',
              parts: [
                {
                  text: `Parse this exam text into structured questions JSON:\n\n${extractedTextPayload}\n\nReturn JSON: { "totalPages": 1, "warnings": [], "questions": [{ "num": 1, "question": "...", "options": ["A", "B", "C", "D"], "answer": 1, "points": 1, "explanation": "", "hasDiagram": false, "pageNumber": 1 }] }`
                }
              ]
            }
          ];
        }

        // Multi-model chain: gemini-3.5-flash-lite (fast, high-throughput), gemini-3.8-flash, gemini-3.1-flash-lite
        const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
        let response: any = null;
        let lastError: any = null;

        for (const model of candidateModels) {
          try {
            console.log(`Attempting PDF extraction with model: ${model}`);
            response = await ai.models.generateContent({
              model,
              contents,
              config: {
                responseMimeType: 'application/json',
              },
            });
            if (response && response.text) {
              console.log(`PDF extraction succeeded with model: ${model}`);
              break;
            }
          } catch (mErr: any) {
            console.warn(`Model ${model} failed:`, mErr.message || mErr);
            lastError = mErr;
          }
        }

        if (!response) {
          throw lastError || new Error('All Gemini candidate models failed to generate response');
        }

        const rawText = response.text || '{}';
        let parsed: any;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) parsed = JSON.parse(match[0]);
          else throw new Error('Could not parse Gemini JSON response');
        }

        const questions = (parsed.questions || []).map((q: any, idx: number) => {
          let opts = Array.isArray(q.options) ? q.options.map(String) : [];
          while (opts.length < 4) {
            opts.push(`Option ${String.fromCharCode(65 + opts.length)}`);
          }
          if (opts.length > 4) opts = opts.slice(0, 4);

          let ans = Number(q.answer);
          if (isNaN(ans) || ans < 1 || ans > 4) ans = 1;

          return {
            num: Number(q.num) || idx + 1,
            question: q.question || `Question ${idx + 1}`,
            options: opts as [string, string, string, string],
            answer: ans,
            points: Number(q.points) || 1,
            explanation: q.explanation || '',
            hasDiagram: Boolean(q.hasDiagram),
            pageNumber: Number(q.pageNumber) || 1,
            warning: q.warning || undefined,
          };
        });

        return NextResponse.json({
          success: true,
          mode: 'gemini-ai',
          totalPages: parsed.totalPages || 1,
          warnings: parsed.warnings || [],
          questions,
        });
      } catch (geminiError: any) {
        console.error('Gemini API call failed:', geminiError);
        return NextResponse.json(
          {
            error: `Gemini API Error: ${geminiError.message || 'Failed to call Gemini API'}. Check that your GEMINI_API_KEY is valid.`,
            details: String(geminiError),
          },
          { status: 500 }
        );
      }
    }

    // If NO GEMINI_API_KEY is provided:
    // If client sent extracted text from PDF, parse that text dynamically!
    if (extractedTextPayload && extractedTextPayload.trim().length > 20) {
      const parsedFromText = parseExamTextDirectly(extractedTextPayload);
      if (parsedFromText.questions.length > 0) {
        return NextResponse.json({
          success: true,
          mode: 'pdf-text-parser',
          message: 'Extracted questions directly from PDF text (Provide GEMINI_API_KEY for advanced AI OCR)',
          totalPages: parsedFromText.totalPages,
          warnings: [
            'Parsed directly from PDF text structure without Gemini API key.',
            'For scanned or multi-column papers, enter a Gemini API Key to enable AI Vision extraction.'
          ],
          questions: parsedFromText.questions,
        });
      }
    }

    // Fallback: Inform user to provide an API key or use the text parser
    return NextResponse.json(
      {
        error: 'No Gemini API Key provided. Please enter your GEMINI_API_KEY or set it in .env.local to enable Gemini AI PDF extraction.',
        needsApiKey: true,
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error in /api/import-pdf:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process PDF' },
      { status: 500 }
    );
  }
}

// Direct rule-based text parser fallback for digital PDFs
function parseExamTextDirectly(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions: any[] = [];
  let currentQ: any = null;
  let qNumCounter = 1;

  // Regex patterns
  const qStartRegex = /^(?:Q(?:uestion)?\.?\s*(\d+)[:.]?|(\d+)[:.]\s+)(.*)/i;
  const optRegex = /^(?:\(?([A-Da-d1-4])\)?[:.]?\s+)(.*)/;
  const diagramRegex = /\b(diagram|figure|graph|circuit|shown below|refer to|image|chart)\b/i;

  for (const line of lines) {
    const qMatch = line.match(qStartRegex);
    if (qMatch) {
      if (currentQ && currentQ.question) {
        normalizeAndPush(currentQ, questions);
      }
      const num = Number(qMatch[1] || qMatch[2]) || qNumCounter++;
      const text = qMatch[3] || '';
      currentQ = {
        num,
        question: text,
        options: [],
        answer: 1,
        points: 1,
        explanation: '',
        hasDiagram: diagramRegex.test(text),
        pageNumber: 1,
      };
      continue;
    }

    if (currentQ) {
      const optMatch = line.match(optRegex);
      if (optMatch && currentQ.options.length < 4) {
        currentQ.options.push(optMatch[2]);
      } else {
        if (currentQ.options.length === 0) {
          currentQ.question += ' ' + line;
          if (diagramRegex.test(line)) currentQ.hasDiagram = true;
        } else if (currentQ.options.length > 0 && currentQ.options.length <= 4) {
          currentQ.options[currentQ.options.length - 1] += ' ' + line;
        }
      }
    }
  }

  if (currentQ && currentQ.question) {
    normalizeAndPush(currentQ, questions);
  }

  return {
    totalPages: 1,
    questions,
  };
}

function normalizeAndPush(q: any, list: any[]) {
  while (q.options.length < 4) {
    q.options.push(`Option ${String.fromCharCode(65 + q.options.length)}`);
  }
  if (q.options.length > 4) q.options = q.options.slice(0, 4);
  list.push(q);
}
