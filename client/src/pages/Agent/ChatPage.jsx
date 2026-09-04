import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { gsap } from 'gsap';
import {
  Send, Bot, User, Loader2, Trash2, Package, AlertTriangle,
  CheckCircle, XCircle, ChevronDown, ChevronUp, Sparkles, Wifi, WifiOff
} from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';

// ── Ollama API call with tool use (Llama 3.1) ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are CoreInventory AI Assistant — an intelligent inventory management assistant with direct access to the CoreInventory database.

You can help users:
- Check stock levels, find low/out-of-stock products
- View and create receipts, delivery orders, internal transfers
- Manage products, warehouses, and locations
- Get dashboard statistics and movement history
- Run complex inventory queries

IMPORTANT RULES:
- Always confirm destructive actions (validate/cancel) before executing when the intent is ambiguous
- When creating operations, always verify the required fields before calling the tool
- Present numbers and data in a clean, readable format
- If a query returns many results, summarize and highlight the important parts
- Be proactive: if someone asks about stock, also mention any alerts
- Always be helpful and concise
- When you need to look up IDs (product_id, location_id etc.), use list_products / list_locations / list_warehouses first

You have access to the following tools. Always use them when appropriate.`;

const TOOLS = [
  { name: "get_dashboard_stats", description: "Get real-time dashboard KPIs: total products, low stock, pending receipts/deliveries, internal transfers.", input_schema: { type: "object", properties: {} } },
  { name: "list_products", description: "List all products with stock levels. Filter by category, warehouse, location, search text, or low_stock_only.", input_schema: { type: "object", properties: { search: { type: "string" }, category_id: { type: "integer" }, warehouse_id: { type: "integer" }, location_id: { type: "integer" }, low_stock_only: { type: "boolean" } } } },
  { name: "get_product", description: "Get full details of a product including stock distribution across all locations.", input_schema: { type: "object", properties: { product_id: { type: "integer" }, sku: { type: "string" } } } },
  { name: "get_product_timeline", description: "Get full movement history for a product with running balance.", input_schema: { type: "object", required: ["product_id"], properties: { product_id: { type: "integer" }, limit: { type: "integer" } } } },
  { name: "create_product", description: "Create a new product.", input_schema: { type: "object", required: ["name", "sku"], properties: { name: { type: "string" }, sku: { type: "string" }, category_id: { type: "integer" }, unit_of_measure: { type: "string" }, cost_price: { type: "number" }, reorder_point: { type: "number" }, initial_stock: { type: "number" }, location_id: { type: "integer" } } } },
  { name: "list_categories", description: "List all product categories.", input_schema: { type: "object", properties: {} } },
  { name: "create_category", description: "Create a new product category.", input_schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } },
  { name: "list_warehouses", description: "List all warehouses.", input_schema: { type: "object", properties: {} } },
  { name: "list_locations", description: "List locations, optionally filtered by warehouse.", input_schema: { type: "object", properties: { warehouse_id: { type: "integer" } } } },
  { name: "get_location_stock", description: "Get all products at a specific location.", input_schema: { type: "object", required: ["location_id"], properties: { location_id: { type: "integer" } } } },
  { name: "create_warehouse", description: "Create a new warehouse.", input_schema: { type: "object", required: ["name", "short_code"], properties: { name: { type: "string" }, short_code: { type: "string" } } } },
  { name: "create_location", description: "Create a new location.", input_schema: { type: "object", required: ["name", "short_code", "warehouse_id"], properties: { name: { type: "string" }, short_code: { type: "string" }, warehouse_id: { type: "integer" } } } },
  { name: "get_stock_levels", description: "Get current stock levels with on_hand, free_to_use, total_value. Filter by warehouse, location, or low_stock_only.", input_schema: { type: "object", properties: { search: { type: "string" }, warehouse_id: { type: "integer" }, location_id: { type: "integer" }, low_stock_only: { type: "boolean" } } } },
  { name: "get_stock_alerts", description: "Get all products that are out of stock or below reorder point.", input_schema: { type: "object", properties: {} } },
  { name: "adjust_stock", description: "Manually adjust stock quantity for a product at a location (sets absolute quantity).", input_schema: { type: "object", required: ["product_id", "location_id", "quantity"], properties: { product_id: { type: "integer" }, location_id: { type: "integer" }, quantity: { type: "number" }, notes: { type: "string" } } } },
  { name: "list_receipts", description: "List receipt operations. Filter by status, search.", input_schema: { type: "object", properties: { status: { type: "string" }, search: { type: "string" }, warehouse_id: { type: "integer" }, limit: { type: "integer" } } } },
  { name: "get_receipt", description: "Get full details of a receipt.", input_schema: { type: "object", required: ["receipt_id"], properties: { receipt_id: { type: "integer" } } } },
  { name: "create_receipt", description: "Create a new receipt (incoming goods).", input_schema: { type: "object", required: ["warehouse_id", "to_location_id", "lines"], properties: { warehouse_id: { type: "integer" }, to_location_id: { type: "integer" }, contact: { type: "string" }, scheduled_date: { type: "string" }, notes: { type: "string" }, lines: { type: "array", items: { type: "object", properties: { product_id: { type: "integer" }, quantity: { type: "number" } } } } } } },
  { name: "validate_receipt", description: "Validate a receipt - increases stock and marks as done.", input_schema: { type: "object", required: ["receipt_id"], properties: { receipt_id: { type: "integer" } } } },
  { name: "cancel_receipt", description: "Cancel a receipt.", input_schema: { type: "object", required: ["receipt_id"], properties: { receipt_id: { type: "integer" } } } },
  { name: "list_deliveries", description: "List delivery orders. Filter by status, search.", input_schema: { type: "object", properties: { status: { type: "string" }, search: { type: "string" }, warehouse_id: { type: "integer" }, limit: { type: "integer" } } } },
  { name: "get_delivery", description: "Get full details of a delivery.", input_schema: { type: "object", required: ["delivery_id"], properties: { delivery_id: { type: "integer" } } } },
  { name: "create_delivery", description: "Create a new delivery order.", input_schema: { type: "object", required: ["warehouse_id", "from_location_id", "lines"], properties: { warehouse_id: { type: "integer" }, from_location_id: { type: "integer" }, contact: { type: "string" }, scheduled_date: { type: "string" }, notes: { type: "string" }, lines: { type: "array", items: { type: "object", properties: { product_id: { type: "integer" }, quantity: { type: "number" } } } } } } },
  { name: "validate_delivery", description: "Validate a delivery - decreases stock, marks as done.", input_schema: { type: "object", required: ["delivery_id"], properties: { delivery_id: { type: "integer" } } } },
  { name: "cancel_delivery", description: "Cancel a delivery.", input_schema: { type: "object", required: ["delivery_id"], properties: { delivery_id: { type: "integer" } } } },
  { name: "list_transfers", description: "List internal transfers.", input_schema: { type: "object", properties: { status: { type: "string" }, search: { type: "string" }, limit: { type: "integer" } } } },
  { name: "get_transfer", description: "Get full details of a transfer.", input_schema: { type: "object", required: ["transfer_id"], properties: { transfer_id: { type: "integer" } } } },
  { name: "create_transfer", description: "Create an internal transfer between locations.", input_schema: { type: "object", required: ["from_location_id", "to_location_id", "lines"], properties: { from_location_id: { type: "integer" }, to_location_id: { type: "integer" }, warehouse_id: { type: "integer" }, scheduled_date: { type: "string" }, notes: { type: "string" }, lines: { type: "array", items: { type: "object", properties: { product_id: { type: "integer" }, quantity: { type: "number" } } } } } } },
  { name: "validate_transfer", description: "Validate a transfer - moves stock between locations.", input_schema: { type: "object", required: ["transfer_id"], properties: { transfer_id: { type: "integer" } } } },
  { name: "get_move_history", description: "Get stock movement history. Filter by product, type, date range.", input_schema: { type: "object", properties: { product_id: { type: "integer" }, move_type: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" }, search: { type: "string" }, limit: { type: "integer" } } } },
  { name: "run_sql_query", description: "Run a SELECT SQL query directly. Only for complex custom reporting.", input_schema: { type: "object", required: ["sql"], properties: { sql: { type: "string" } } } },
];

async function callTool(toolName, toolInput, jwt) {
  const res = await fetch(`${import.meta.env.VITE_BASE_URL}/api/chatbot/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ tool: toolName, input: toolInput }),
  });
  if (!res.ok) throw new Error(`Tool call failed: ${res.status}`);
  return res.json();
}

// Format tools for Ollama (using OpenAI-compatible format)
function formatToolsForOllama(tools) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

// Check if Ollama is running and model is available
async function checkOllamaStatus(ollamaUrl, modelName) {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.models?.some(m => m.name.includes(modelName)) || false;
  } catch (error) {
    return false;
  }
}

async function runAgentLoop(messages, jwt, onToolCall, onDone, onStatusUpdate) {
  const history = [...messages];
  const ollamaUrl = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:latest';
  
  // Check Ollama status first
  const isOllamaRunning = await checkOllamaStatus(ollamaUrl, ollamaModel);
  if (!isOllamaRunning) {
    throw new Error(`Ollama is not running or model '${ollamaModel}' not found. Please start Ollama and pull the model: 'ollama pull ${ollamaModel}'`);
  }
  
  onStatusUpdate?.(true);

  let iterationCount = 0;
  const maxIterations = 10;

  while (iterationCount < maxIterations) {
    iterationCount++;
    
    // Prepare messages for Ollama
    const ollamaMessages = [];
    
    // Add system prompt
    ollamaMessages.push({
      role: 'system',
      content: SYSTEM_PROMPT,
    });
    
    // Convert history to Ollama format
    for (const msg of history) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          ollamaMessages.push({ role: 'user', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // Handle tool results
          for (const tr of msg.content) {
            if (tr.type === 'tool_result') {
              ollamaMessages.push({ 
                role: 'tool', 
                content: tr.content,
                tool_call_id: tr.tool_use_id,
              });
            }
          }
        }
      } else if (msg.role === 'assistant') {
        if (Array.isArray(msg.content)) {
          const textContent = msg.content.find(c => c.type === 'text')?.text || '';
          const toolCalls = msg.content.filter(c => c.type === 'tool_use');
          
          if (toolCalls.length > 0) {
            ollamaMessages.push({
              role: 'assistant',
              content: textContent,
              tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.input),
                },
              })),
            });
          } else if (textContent) {
            ollamaMessages.push({ role: 'assistant', content: textContent });
          }
        } else if (typeof msg.content === 'string') {
          ollamaMessages.push({ role: 'assistant', content: msg.content });
        }
      }
    }

    // Make request to Ollama
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 4096,
        },
        tools: formatToolsForOllama(TOOLS),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const assistantMessage = data.message;
    
    if (!assistantMessage) {
      throw new Error('No response from Ollama');
    }

    // Check for tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message to history
      const assistantContent = [];
      if (assistantMessage.content) {
        assistantContent.push({ type: 'text', text: assistantMessage.content });
      }
      for (const toolCall of assistantMessage.tool_calls) {
        assistantContent.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
      history.push({ role: 'assistant', content: assistantContent });
      
      // Execute all tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);
        
        onToolCall(toolName, toolInput);
        
        try {
          const result = await callTool(toolName, toolInput, jwt);
          
          // Add tool result to history
          history.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolCall.id, content: JSON.stringify(result) }],
          });
        } catch (err) {
          history.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolCall.id, content: JSON.stringify({ error: err.message }) }],
          });
        }
      }
      
      // Continue the loop
      continue;
    }
    
    // No tool calls, return the text response
    const finalText = assistantMessage.content || 'I apologize, but I encountered an issue processing your request.';
    
    // Add the final assistant response to history
    history.push({
      role: 'assistant',
      content: finalText,
    });
    
    onDone(finalText);
    onStatusUpdate?.(false);
    return history;
  }
  
  onStatusUpdate?.(false);
  throw new Error('Maximum iterations reached without completing');
}

// ── UI Components ────────────────────────────────────────────────────────────

function ToolCallBadge({ name, input, expanded, onToggle }) {
  const TOOL_ICONS = {
    get_dashboard_stats: '📊', list_products: '📦', get_product: '🔍',
    create_product: '➕', get_stock_levels: '📋', get_stock_alerts: '🚨',
    adjust_stock: '⚖️', list_receipts: '📥', create_receipt: '📥',
    validate_receipt: '✅', list_deliveries: '🚚', create_delivery: '🚚',
    validate_delivery: '✅', list_transfers: '🔄', create_transfer: '🔄',
    validate_transfer: '✅', get_move_history: '📜', run_sql_query: '🗄️',
  };
  const icon = TOOL_ICONS[name] || '🔧';
  const prettyName = name.replace(/_/g, ' ');

  return (
    <div className="my-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-900/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        <span className="text-base leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 capitalize">{prettyName}</span>
          {!expanded && Object.keys(input).length > 0 && (
            <span className="text-xs text-indigo-400 ml-2 truncate">
              {Object.entries(input).slice(0, 2).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}
            </span>
          )}
        </div>
        <span className="text-indigo-400">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {expanded && Object.keys(input).length > 0 && (
        <div className="px-3 pb-2">
          <pre className="text-xs text-indigo-600 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/30 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }) {
  const [expandedTools, setExpandedTools] = useState({});
  const toggle = (i) => setExpandedTools(p => ({ ...p, [i]: !p[i] }));

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-sm">
          {msg.content}
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 ml-2 mt-1">
          <User size={14} className="text-slate-500 dark:text-slate-400" />
        </div>
      </div>
    );
  }

  if (msg.role === 'tool_calling') {
    return (
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={15} className="text-white" />
        </div>
        <div className="flex-1 max-w-[85%]">
          {msg.tools.map((t, i) => (
            <ToolCallBadge
              key={i}
              name={t.name}
              input={t.input}
              expanded={!!expandedTools[i]}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (msg.role === 'thinking') {
    return (
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Loader2 size={15} className="text-white animate-spin" />
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
          <div className="flex gap-1.5 items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex items-start gap-2 mb-4">
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Show me the dashboard stats",
  "Which products are low on stock?",
  "List all pending deliveries",
  "How many units of Steel Rods do we have?",
  "Show me recent stock movements",
  "Create a receipt for 50 units of DESK001 from vendor Godrej",
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { token, user } = useSelector(s => s.auth);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiHistory, setApiHistory] = useState([]);
  const [ollamaConnected, setOllamaConnected] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const headerRef = useRef(null);

  // Check Ollama connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      const ollamaUrl = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
      try {
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          const modelName = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:latest';
          const hasModel = data.models?.some(m => m.name.includes(modelName));
          setOllamaConnected(hasModel ? true : 'no-model');
        } else {
          setOllamaConnected(false);
        }
      } catch (error) {
        setOllamaConnected(false);
      }
    };
    checkConnection();
  }, []);

  useEffect(() => {
    gsap.fromTo(headerRef.current,
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (msg) => setMessages(prev => [...prev, msg]);
  const removeThinking = () => setMessages(prev => prev.filter(m => m.role !== 'thinking'));

  const send = async (text) => {
    if (!text.trim() || loading) return;
    
    // Check Ollama connection before sending
    if (ollamaConnected !== true) {
      addMsg({ role: 'assistant', content: `⚠️ Ollama is not connected. Please ensure Ollama is running and the model is downloaded.\n\nTo fix:\n1. Start Ollama: \`ollama serve\`\n2. Pull the model: \`ollama pull ${import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:latest'}\`\n3. Refresh the page` });
      return;
    }
    
    const userText = text.trim();
    setInput('');
    setLoading(true);

    addMsg({ role: 'user', content: userText });
    addMsg({ role: 'thinking' });

    const newHistory = [...apiHistory, { role: 'user', content: userText }];

    try {
      const finalHistory = await runAgentLoop(
        newHistory,
        token,
        (toolName, toolInput) => {
          removeThinking();
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'tool_calling') {
              return [...prev.slice(0, -1), { role: 'tool_calling', tools: [...last.tools, { name: toolName, input: toolInput }] }];
            }
            return [...prev, { role: 'tool_calling', tools: [{ name: toolName, input: toolInput }] }];
          });
          addMsg({ role: 'thinking' });
        },
        (finalText) => {
          removeThinking();
          addMsg({ role: 'assistant', content: finalText });
        },
        (connected) => {
          // Optional: update connection status during runtime
        }
      );
      setApiHistory(finalHistory);
    } catch (err) {
      console.error('Ollama API error:', err);
      removeThinking();
      let errorMsg = err.message;
      if (err.message.includes('ECONNREFUSED') || err.message.includes('Failed to fetch')) {
        errorMsg = 'Cannot connect to Ollama. Please ensure Ollama is running on your machine.\n\nStart Ollama with: `ollama serve`';
      } else if (err.message.includes('model not found')) {
        errorMsg = `Model not found. Please pull the model first:\n\`ollama pull ${import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:latest'}\``;
      }
      addMsg({ role: 'assistant', content: `⚠️ Error: ${errorMsg}` });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setApiHistory([]);
  };

  // Status indicator
  const getStatusIcon = () => {
    if (ollamaConnected === true) return <Wifi size={12} className="text-green-500" />;
    if (ollamaConnected === 'no-model') return <WifiOff size={12} className="text-yellow-500" />;
    if (ollamaConnected === false) return <WifiOff size={12} className="text-red-500" />;
    return <Loader2 size={12} className="animate-spin text-slate-400" />;
  };

  const getStatusText = () => {
    if (ollamaConnected === true) return 'Ollama Connected';
    if (ollamaConnected === 'no-model') return 'Model not found - run ollama pull';
    if (ollamaConnected === false) return 'Ollama not running';
    return 'Checking Ollama...';
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-88px)]">
      <Breadcrumb />

      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white">Inventory AI Assistant</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-slate-400">Powered by Ollama · Llama 3.1</p>
              <div className="flex items-center gap-1 ml-2">
                {getStatusIcon()}
                <span className="text-[10px] text-slate-400">{getStatusText()}</span>
              </div>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-3 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
              <Bot size={28} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
              Hello{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}! 👋
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-8">
              I can help you manage inventory — check stock, create orders, view history, and much more.
            </p>
            {ollamaConnected !== true && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl max-w-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                  ⚠️ {ollamaConnected === false ? 'Ollama is not running' : 'Model not downloaded'}
                </p>
                <code className="text-xs bg-slate-800 text-slate-200 px-2 py-1 rounded">
                  ollama pull {import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1:latest'}
                </code>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  disabled={ollamaConnected !== true}
                  className="text-left px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-700 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your inventory... (Enter to send, Shift+Enter for newline)"
            disabled={loading || ollamaConnected !== true}
            rows={1}
            className="w-full px-4 py-3 pr-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 text-sm resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all disabled:opacity-60"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim() || ollamaConnected !== true}
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-sm"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}