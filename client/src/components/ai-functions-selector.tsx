import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, MessageSquare, Calendar, Search, Wand2, Video, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Conversation } from '@shared/schema';
import { cn } from '@/lib/utils';

interface AIFunctionsSelectorProps {
  selectedFunction: 'image-enhancement' | 'image-to-video';
  onFunctionSelect: (functionKey: 'image-enhancement' | 'image-to-video') => void;
  currentConversationId: string | null;
  onConversationSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
}

export function AIFunctionsSelector({ 
  selectedFunction,
  onFunctionSelect,
  currentConversationId,
  onConversationSelect,
  onNewConversation
}: AIFunctionsSelectorProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch conversations for current user
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const functionTitle = selectedFunction === 'image-enhancement' 
        ? 'Image Enhancement' 
        : 'Image to Video';
      
      const response = await apiRequest('POST', '/api/conversations', {
        title: `New ${functionTitle} Session`
      });
      return response.json();
    },
    onSuccess: (conversation: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      onConversationSelect(conversation);
      onNewConversation();
      toast({
        title: 'New conversation created',
        description: 'Start chatting to enhance your images!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create conversation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter conversations based on search term
  const filteredConversations = conversations.filter(conversation =>
    conversation.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group conversations by date
  const groupedConversations = filteredConversations.reduce((groups, conversation) => {
    const date = new Date(conversation.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(conversation);
    return groups;
  }, {} as Record<string, Conversation[]>);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoading) {
    return (
      <div className="w-80 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex items-center justify-center">
        <div className="text-[#888888]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 border border-[#ffd700] bg-[#ffd700]/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#ffd700]" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">AI Functions</h2>
            <p className="text-sm text-[#888888]">Select your workflow</p>
          </div>
        </div>

        {/* Function Selection Buttons */}
        <div className="space-y-2 mb-4">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-12 px-4 transition-all duration-200",
              selectedFunction === 'image-enhancement'
                ? "bg-[#ffd700] text-black hover:bg-[#ffd700]/80"
                : "bg-[#0f0f0f] text-white border border-[#2a2a2a] hover:bg-[#2a2a2a] hover:border-[#3a3a3a]"
            )}
            onClick={() => onFunctionSelect('image-enhancement')}
            data-testid="button-image-enhancement"
          >
            <Wand2 className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Product Image Enhancement</div>
              <div className="text-xs opacity-70">Enhance product images with background removal, color correction, and style transfer</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-12 px-4 transition-all duration-200",
              selectedFunction === 'image-to-video'
                ? "bg-[#ffd700] text-black hover:bg-[#ffd700]/80"
                : "bg-[#0f0f0f] text-white border border-[#2a2a2a] hover:bg-[#2a2a2a] hover:border-[#3a3a3a]"
            )}
            onClick={() => onFunctionSelect('image-to-video')}
            data-testid="button-image-to-video"
          >
            <Video className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-medium">Product Image to Video</div>
              <div className="text-xs opacity-70">Convert product images into engaging video content with animations and effects</div>
            </div>
          </Button>
        </div>

        <Separator className="bg-[#2a2a2a] mb-4" />

        {/* Chat Section Header */}
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-4 h-4 text-[#ffd700]" />
          <h3 className="font-semibold text-white">Chat History</h3>
        </div>
        
        {/* New Chat Button */}
        <Button 
          onClick={() => createConversationMutation.mutate()}
          disabled={createConversationMutation.isPending}
          className="w-full bg-[#ffd700] hover:bg-[#ffd700]/80 text-black font-medium mb-3"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4 mr-2" />
          {createConversationMutation.isPending ? 'Creating...' : 'New Chat'}
        </Button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#888888]" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-[#888888]"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.entries(groupedConversations).length === 0 ? (
            <div className="p-4 text-center text-[#888888]">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to get began!</p>
            </div>
          ) : (
            Object.entries(groupedConversations)
              .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
              .map(([date, groupConversations]) => (
                <div key={date} className="mb-4">
                  {/* Date Header */}
                  <div className="flex items-center gap-2 px-2 py-1 mb-2">
                    <Calendar className="w-3 h-3 text-[#888888]" />
                    <span className="text-xs font-medium text-[#888888] uppercase tracking-wide">
                      {formatDate(date)}
                    </span>
                  </div>
                  
                  {/* Conversations for this date */}
                  {groupConversations
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((conversation) => (
                      <Card 
                        key={conversation.id}
                        className={cn(
                          "group mb-2 cursor-pointer transition-all duration-200 hover:bg-[#2a2a2a]",
                          currentConversationId === conversation.id 
                            ? "bg-[#2a2a2a] border-[#ffd700] border-2" 
                            : "bg-[#0f0f0f] border-[#2a2a2a] hover:border-[#3a3a3a]"
                        )}
                        onClick={() => onConversationSelect(conversation)}
                        data-testid={`conversation-card-${conversation.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className={cn(
                                "text-sm font-medium truncate",
                                currentConversationId === conversation.id 
                                  ? "text-[#ffd700]" 
                                  : "text-white"
                              )}>
                                {conversation.title}
                              </h3>
                              <p className="text-xs text-[#888888] mt-1">
                                {formatTime(conversation.createdAt)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}