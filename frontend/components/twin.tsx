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
                    className="font-medium underline underline-offset-2"
                >
                    {match[2]}
                </a>
            );
        } else if (match[4]) {
            nodes.push(
                <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-slate-800">
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
                        <blockquote key={index} className="border-l-4 border-slate-300 pl-3 text-slate-600">
                            {renderInlineMarkdown(block.content)}
                        </blockquote>
                    );
                }

                if (block.type === 'code') {
                    return (
                        <pre
                            key={index}
                            className="overflow-x-auto rounded-md bg-slate-900 p-3 text-sm text-slate-100"
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
        let buffer = '';

        const processEvent = (event: string) => {
            const data = event
                .split(/\r?\n/)
                .filter(line => line.startsWith('data:'))
                .map(line => {
                    const value = line.slice(5);
                    return value.startsWith(' ') ? value.slice(1) : value;
                })
                .join('\n');

            if (data) {
                appendAssistantContent(assistantMessageId, data);
            }
        };

        while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.match(/\r?\n\r?\n/);
            while (boundary) {
                const boundaryIndex = boundary.index ?? 0;
                const event = buffer.slice(0, boundaryIndex);

                buffer = buffer.slice(boundaryIndex + boundary[0].length);
                processEvent(event);
                boundary = buffer.match(/\r?\n\r?\n/);
            }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
            processEvent(buffer);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const assistantMessageId = `${Date.now() + 1}`;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
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
        <div className="flex flex-col h-full bg-gray-50 rounded-lg shadow-lg">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-4 rounded-t-lg">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Bot className="w-6 h-6" />
                    Thomas Juma&apos;s Digital Twin
                </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-8">
                        {hasAvatar ? (
                            <img 
                                src="/avatar.jpeg" 
                                alt="Digital Twin Avatar" 
                                className="w-20 h-20 rounded-full mx-auto mb-3 border-2 border-gray-300"
                            />
                        ) : (
                            <Bot className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        )}
                        <p>Hello! I&apos;m Thomas&apos; Digital Twin.</p>
                        <p className="text-sm mt-2">Ask me anything about Thomas&apos; career, skills and abilities!</p>
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
                                        className="w-8 h-8 rounded-full border border-slate-300"
                                    />
                                ) : (
                                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                )}
                            </div>
                        )}

                        <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                                message.role === 'user'
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-white border border-gray-200 text-gray-800'
                            }`}
                        >
                            {message.role === 'assistant' ? (
                                <MarkdownMessage content={message.content} />
                            ) : (
                                <p className="whitespace-pre-wrap">{message.content}</p>
                            )}
                            <p
                                className={`text-xs mt-1 ${
                                    message.role === 'user' ? 'text-slate-300' : 'text-gray-500'
                                }`}
                            >
                                {message.timestamp.toLocaleTimeString()}
                            </p>
                        </div>

                        {message.role === 'user' && (
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-white" />
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
                                    className="w-8 h-8 rounded-full border border-slate-300"
                                />
                            ) : (
                                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            )}
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent text-gray-800"
                        disabled={isLoading}
                        autoFocus
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
