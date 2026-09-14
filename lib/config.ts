function required(name: "GROQ_API_KEY" | "VOICE_INBOX_TOKEN") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export const config = {
  databaseUrl: () => {
    const value = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!value) throw new Error("DATABASE_URL or POSTGRES_URL is not configured");
    return value;
  },
  groqApiKey: () => required("GROQ_API_KEY"),
  token: () => required("VOICE_INBOX_TOKEN"),
  awsRegion: () => process.env.AWS_REGION ?? "us-east-1",
  bedrockModelId: () => process.env.BEDROCK_MODEL_ID ?? "global.anthropic.claude-haiku-4-5-20251001-v1:0",
};
