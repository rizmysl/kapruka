export const getParsedData = (rawData: any): any => {
  if (!rawData) return null;
  if (rawData.results || rawData.id || rawData.checkout_url || rawData.order_number || rawData.city || rawData.available !== undefined) {
    return rawData;
  }
  if (typeof rawData.result === 'string') {
    try { return JSON.parse(rawData.result); } catch { return rawData; }
  }
  if (rawData.result && typeof rawData.result === 'object') return rawData.result;
  if (Array.isArray(rawData.content)) {
    for (const part of rawData.content) {
      if (part?.type === 'text' && typeof part.text === 'string') {
        try { return JSON.parse(part.text); } catch { return { text_content: part.text }; }
      }
    }
  }
  if (rawData.structuredContent && typeof rawData.structuredContent === 'object') return rawData.structuredContent;
  return rawData;
};

export const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    let timeOfDay = 'morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17) timeOfDay = 'evening';
    
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    
    if (isWeekend && hour < 12) {
        return "Ayubowan! It's a beautiful weekend morning in Colombo. Looking for the perfect gift?";
    }
    
    return `Ayubowan! Good ${timeOfDay}. Let's find exactly what you need today.`;
};
