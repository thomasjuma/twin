'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Send, Bot, User } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

type MarkdownBlock =
    | { type: 'paragraph'; content: string }
    | { type: 'heading'; level: 1 | 2 | 3; content: string }
    | { type: 'unordered-list'; items: string[] }
    | { type: 'ordered-list'; items: { value: number; content: string }[] }
    | { type: 'blockquote'; content: string }
    | { type: 'code'; language: string; content: string };

const parseMarkdownBlocks = (content: string): MarkdownBlock[] => {
    const blocks: MarkdownBlock[] = [];
    const lines = content.split(/\r?\n/);
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            index += 1;
            continue;
        }

        const codeFenceMatch = trimmedLine.match(/^```(\w+)?\s*$/);
        if (codeFenceMatch) {
            const codeLines: string[] = [];
            index += 1;

            while (index < lines.length && !lines[index].trim().startsWith('```')) {
                codeLines.push(lines[index]);
                index += 1;
            }

            if (index < lines.length) {
                index += 1;
            }

            blocks.push({
                type: 'code',
                language: codeFenceMatch[1] ?? '',
                content: codeLines.join('\n'),
            });
            continue;
        }

        const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length as 1 | 2 | 3,
                content: headingMatch[2],
            });
            index += 1;
            continue;
        }

        if (/^[-*]\s+/.test(trimmedLine)) {
            const items: string[] = [];

            while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
                index += 1;
            }

            blocks.push({ type: 'unordered-list', items });
            continue;
        }

        if (/^\d+\.\s+/.test(trimmedLine)) {
            const items: { value: number; content: string }[] = [];

            while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
                const listItemMatch = lines[index].trim().match(/^(\d+)\.\s+(.+)$/);

                if (listItemMatch) {
                    items.push({
                        value: Number(listItemMatch[1]),
                        content: listItemMatch[2],
                    });
                }

                index += 1;
            }

            blocks.push({ type: 'ordered-list', items });
            continue;
        }

        if (trimmedLine.startsWith('>')) {
            const quoteLines: string[] = [];

            while (index < lines.length && lines[index].trim().startsWith('>')) {
                quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
                index += 1;
            }

            blocks.push({ type: 'blockquote', content: quoteLines.join(' ') });
            continue;
        }

        const paragraphLines: string[] = [];

        while (
            index < lines.length
            && lines[index].trim()
            && !lines[index].trim().match(/^```(\w+)?\s*$/)
            && !lines[index].trim().match(/^(#{1,3})\s+(.+)$/)
            && !/^[-*]\s+/.test(lines[index].trim())
            && !/^\d+\.\s+/.test(lines[index].trim())
            && !lines[index].trim().startsWith('>')
        ) {
            paragraphLines.push(lines[index].trim());
            index += 1;
        }

        blocks.push({ type: 'paragraph', content: paragraphLines.join(' ') });
    }

    return blocks;
};

const renderInlineMarkdown = (content: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const inlinePattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlinePattern.exec(content)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(content.slice(lastIndex, match.index));
        }

        const key = `${match.index}-${match[0]}`;

        if (match[2] && match[3]) {
            nodes.push(
                <a
                    key={key}
                    href={match[3]}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
                >
                    {match[2]}
                </a>
            );
        } else if (match[4]) {
            nodes.push(
                <code key={key} className="rounded bg-stone-100 px-1 py-0.5 text-[0.9em] text-stone-800">
                    {match[4]}
                </code>
            );
        } else if (match[5]) {
            nodes.push(<strong key={key}>{match[5]}</strong>);
        } else if (match[6]) {
            nodes.push(<em key={key}>{match[6]}</em>);
        }

        lastIndex = inlinePattern.lastIndex;
    }

    if (lastIndex < content.length) {
        nodes.push(content.slice(lastIndex));
    }

    return nodes;
};

function MarkdownMessage({ content }: { content: string }) {
    const blocks = parseMarkdownBlocks(content);

    return (
        <div className="space-y-2">
            {blocks.map((block, index) => {
                if (block.type === 'heading') {
                    const HeadingTag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
                    const headingClasses = block.level === 1
                        ? 'text-lg font-semibold'
                        : block.level === 2
                            ? 'text-base font-semibold'
                            : 'text-sm font-semibold';

                    return (
                        <HeadingTag key={index} className={headingClasses}>
                            {renderInlineMarkdown(block.content)}
                        </HeadingTag>
                    );
                }

                if (block.type === 'unordered-list') {
                    return (
                        <ul key={index} className="list-disc space-y-1 pl-5">
                            {block.items.map((item, itemIndex) => (
                                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
                            ))}
                        </ul>
                    );
                }

                if (block.type === 'ordered-list') {
                    return (
                        <ol key={index} className="list-decimal space-y-1 pl-5" start={block.items[0]?.value ?? 1}>
                            {block.items.map((item, itemIndex) => (
                                <li key={itemIndex} value={item.value}>
                                    {renderInlineMarkdown(item.content)}
                                </li>
                            ))}
                        </ol>
                    );
                }

                if (block.type === 'blockquote') {
                    return (
                        <blockquote key={index} className="border-l-4 border-emerald-200 pl-3 text-stone-600">
                            {renderInlineMarkdown(block.content)}
                        </blockquote>
                    );
                }

                if (block.type === 'code') {
                    return (
                        <pre
                            key={index}
                            className="overflow-x-auto rounded-md bg-stone-900 p-3 text-sm text-stone-100"
                        >
                            <code>{block.content}</code>
                        </pre>
                    );
                }

                if (block.type === 'paragraph') {
                    return <p key={index}>{renderInlineMarkdown(block.content)}</p>;
                }

                return null;
            })}
        </div>
    );
}

export default function Twin() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messageIdCounterRef = useRef(0);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const createMessageId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        messageIdCounterRef.current += 1;
        return `message-${messageIdCounterRef.current}`;
    };

    const appendAssistantContent = (messageId: string, content: string) => {
        setMessages(prev => {
            const existingMessage = prev.find(message => message.id === messageId);

            if (!existingMessage) {
                return [
                    ...prev,
                    {
                        id: messageId,
                        role: 'assistant',
                        content,
                        timestamp: new Date(),
                    },
                ];
            }

            return prev.map(message =>
                message.id === messageId
                    ? { ...message, content: `${message.content}${content}` }
                    : message
            );
        });
    };

    const readStreamingResponse = async (response: Response, assistantMessageId: string) => {
        if (!response.body) {
            throw new Error('Response body is not readable');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            const text = decoder.decode(value, { stream: true });
            if (text) {
                appendAssistantContent(assistantMessageId, text);
            }
        }

        const finalText = decoder.decode();
        if (finalText) {
            appendAssistantContent(assistantMessageId, finalText);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: createMessageId(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const assistantMessageId = createMessageId();

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/plain',
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    session_id: sessionId || undefined,
                }),
            });

            if (!response.ok) throw new Error('Failed to send message');

            const responseSessionId = response.headers.get('X-Session-Id');

            if (responseSessionId) {
                setSessionId(responseSessionId);
            }

            await readStreamingResponse(response, assistantMessageId);
        } catch (error) {
            console.error('Error:', error);
            const errorMessage: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => {
                const existingMessage = prev.find(message => message.id === assistantMessageId);

                if (!existingMessage) {
                    return [...prev, errorMessage];
                }

                return prev.map(message =>
                    message.id === assistantMessageId
                        ? {
                            ...message,
                            content: message.content
                                ? `${message.content}\n\n${errorMessage.content}`
                                : errorMessage.content,
                        }
                        : message
                );
            });
        } finally {
            setIsLoading(false);
            // Refocus the input after message is sent
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    const showLoadingIndicator = isLoading && messages[messages.length - 1]?.role !== 'assistant';

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Check if avatar exists
    const [hasAvatar, setHasAvatar] = useState(false);
    useEffect(() => {
        // Check if avatar.jpeg exists
        fetch('/avatar.jpeg', { method: 'HEAD' })
            .then(res => setHasAvatar(res.ok))
            .catch(() => setHasAvatar(false));
    }, []);

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-stone-200/80 bg-[#fffaf3] shadow-[0_18px_45px_rgba(68,52,38,0.14)]">
            {/* Header */}
            <div className="border-b border-emerald-900/10 bg-[#38564a] px-4 py-4 text-white sm:px-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f3d8ca] text-[#38564a]">
                        <Bot className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold leading-tight sm:text-xl">
                        Thomas Juma&apos;s Digital Twin
                    </h2>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#fffaf3_0%,#f8f1e8_100%)] p-4 sm:p-5">
                {messages.length === 0 && (
                    <div className="mx-auto mt-10 max-w-sm text-center text-stone-500">
                        {hasAvatar ? (
                            <img 
                                src="/avatar.jpeg" 
                                alt="Digital Twin Avatar" 
                                className="mx-auto mb-4 h-20 w-20 rounded-full border-2 border-[#d8c5ad] shadow-sm"
                            />
                        ) : (
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
                                <Bot className="h-8 w-8" />
                            </div>
                        )}
                        <p className="font-medium text-stone-700">Hello! I&apos;m Thomas&apos; Digital Twin.</p>
                        <p className="mt-2 text-sm leading-6">Ask me anything about Thomas&apos; career, skills and abilities!</p>
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        {message.role === 'assistant' && (
                            <div className="flex-shrink-0">
                                {hasAvatar ? (
                                    <img 
                                        src="/avatar.jpeg" 
                                        alt="Digital Twin Avatar" 
                                        className="h-8 w-8 rounded-full border border-[#d8c5ad] shadow-sm"
                                    />
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#38564a] text-white shadow-sm">
                                        <Bot className="h-5 w-5" />
                                    </div>
                                )}
                            </div>
                        )}

                        <div
                            className={`max-w-[82%] rounded-lg px-4 py-3 leading-6 shadow-sm sm:max-w-[74%] ${
                                message.role === 'user'
                                    ? 'bg-[#5d4636] text-white'
                                    : 'border border-stone-200 bg-white text-stone-800'
                            }`}
                        >
                            {message.role === 'assistant' ? (
                                <MarkdownMessage content={message.content} />
                            ) : (
                                <p className="whitespace-pre-wrap">{message.content}</p>
                            )}
                            <p
                                className={`text-xs mt-1 ${
                                    message.role === 'user' ? 'text-stone-200' : 'text-stone-500'
                                }`}
                            >
                                {message.timestamp.toLocaleTimeString()}
                            </p>
                        </div>

                        {message.role === 'user' && (
                            <div className="flex-shrink-0">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c98267] text-white shadow-sm">
                                    <User className="h-5 w-5" />
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {showLoadingIndicator && (
                    <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0">
                            {hasAvatar ? (
                                <img 
                                    src="/avatar.jpeg" 
                                    alt="Digital Twin Avatar" 
                                    className="h-8 w-8 rounded-full border border-[#d8c5ad] shadow-sm"
                                />
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#38564a] text-white shadow-sm">
                                    <Bot className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                            <div className="flex space-x-2">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-[#c98267]" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-[#d8a48e] delay-100" />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-[#38564a] delay-200" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-stone-200 bg-white/95 p-4">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type your message..."
                        className="flex-1 rounded-lg border border-stone-300 bg-[#fffdf9] px-4 py-2.5 text-stone-800 placeholder:text-stone-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#6f927d]"
                        disabled={isLoading}
                        autoFocus
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="rounded-lg bg-[#38564a] px-4 py-2.5 text-white transition-colors hover:bg-[#2f493f] focus:outline-none focus:ring-2 focus:ring-[#6f927d] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
