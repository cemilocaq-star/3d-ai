export const MAX_CHAT_MESSAGES = 16;
export const MAX_MESSAGE_LENGTH = 6000;
export const MAX_CONTEXT_CHARACTERS = 24_000;

export function normalizeChatMessages(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: 'At least one chat message is required.' };
  }

  const recent = input.slice(-MAX_CHAT_MESSAGES);
  const messages = [];

  for (const item of recent) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: 'Each chat message must be an object.' };
    }
    if (item.role !== 'user' && item.role !== 'assistant') {
      return { error: 'Only user and assistant messages are accepted.' };
    }
    if (typeof item.content !== 'string' || !item.content.trim()) {
      return { error: 'Every chat message must contain text.' };
    }
    const content = item.content.trim();
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { error: 'A chat message is too long (maximum 6000 characters).' };
    }
    messages.push({ role: item.role, content });
  }

  if (messages.at(-1)?.role !== 'user') {
    return { error: 'The latest chat message must be from the user.' };
  }

  let totalCharacters = messages.reduce((sum, item) => sum + item.content.length, 0);
  while (totalCharacters > MAX_CONTEXT_CHARACTERS && messages.length > 1) {
    totalCharacters -= messages.shift().content.length;
  }
  if (totalCharacters > MAX_CONTEXT_CHARACTERS) {
    return { error: 'The conversation is too large. Start a new conversation.' };
  }

  return { messages };
}
