/**
 * 英语口语练习评估 Prompt 模板
 */

export interface EvaluationInput {
  transcript: string;
  topic?: string;
  level: string;
  mode: string;
  scenario?: string;
}

export const getEvaluationPrompt = (input: EvaluationInput): string => {
  return `
You are an expert English language assessor. Your task is to analyze a conversation transcript between a Student and an AI Tutor and provide a detailed, constructive evaluation.

### CONTEXT
- Student Level: ${input.level}
- Practice Mode: ${input.mode}
${input.topic ? `- Topic: ${input.topic}` : ''}
${input.scenario ? `- Roleplay Scenario: ${input.scenario}` : ''}

### TRANSCRIPT
${input.transcript}

### EVALUATION CRITERIA
1. **Pronunciation Score (0-100)**: Based on the estimated clarity (infered from transcript quality/confidence if any).
2. **Fluency Score (0-100)**: Pace, hesitation markers, and natural flow.
3. **Grammar Score (0-100)**: Accuracy of tenses, articles, and sentence structure.
4. **Vocabulary Score (0-100)**: Range and appropriateness of word choice.
5. **Task Completion (0-100)**: How well the student communicated their ideas or handled the scenario.

### OUTPUT FORMAT
You MUST return a valid JSON object following this structure (no other text):
{
  "pronunciation_score": number,
  "fluency_score": number,
  "grammar_score": number,
  "vocabulary_score": number,
  "task_completion_score": number,
  "overall_score": number,
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "error_tags": ["string", "string"],
  "suggested_expressions": ["Correction or better way to say X: '...'"],
  "next_step_advice": ["string", "string"]
}

Ensure all scores are floating point numbers between 0 and 100. Provide specific, actionable feedback in "suggested_expressions".
`.trim();
};
