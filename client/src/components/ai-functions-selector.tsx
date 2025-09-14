import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, MessageSquare, Calendar, Search, Wand2, Video, Sparkles, Clock } from 'lucide-react';
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
      <div className="w-80 h-full bg-gradient-to-b from-[#1a1a1a] to-[#151515] border-r border-[#2a2a2a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#ffd700] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm text-[#888888]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-gradient-to-b from-[#1a1a1a] to-[#151515] border-r border-[#2a2a2a] flex flex-col">
      {/* Enhanced Header */}
      <div className="p-5 border-b border-[#2a2a2a] bg-gradient-to-r from-[#1a1a1a] to-[#1f1f1f]">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 border border-[#ffd700] bg-gradient-to-br from-[#ffd700]/20 to-[#ffd700]/5 rounded-xl flex items-center justify-center shadow-lg shadow-[#ffd700]/10">
            <Sparkles className="w-5 h-5 text-[#ffd700] drop-shadow-sm" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-white tracking-tight">AI Functions</h2>
            <p className="text-sm text-[#888888] font-medium">Select your workflow</p>
          </div>
        </div>

        {/* Enhanced Function Selection Buttons */}
        <div className="space-y-3 mb-5">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start p-4 h-auto transition-all duration-300 rounded-xl border",
              selectedFunction === 'image-enhancement'
                ? "bg-gradient-to-r from-[#ffd700] to-[#ffed4a] text-black border-[#ffd700] shadow-lg shadow-[#ffd700]/20 scale-[1.02]"
                : "bg-gradient-to-r from-[#0f0f0f] to-[#1a1a1a] text-white border-[#2a2a2a] hover:border-[#3a3a3a] hover:from-[#2a2a2a] hover:to-[#1f1f1f] hover:scale-[1.01]"
            )}
            onClick={() => onFunctionSelect('image-enhancement')}
            data-testid="button-image-enhancement"
          >
            <div className="flex items-center gap-4 w-full">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                selectedFunction === 'image-enhancement'
                  ? "bg-black/20"
                  : "bg-[#2a2a2a]"
              )}>
                <Wand2 className="w-5 h-5" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-sm">Product Image Enhancement</div>
                <div className={cn(
                  "text-xs mt-1 leading-relaxed",
                  selectedFunction === 'image-enhancement'
                    ? "text-black/70"
                    : "text-[#888888]"
                )}>
                  Background removal, lighting & style enhancement
                </div>
              </div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start p-4 h-auto transition-all duration-300 rounded-xl border",
              selectedFunction === 'image-to-video'
                ? "bg-gradient-to-r from-[#ffd700] to-[#ffed4a] text-black border-[#ffd700] shadow-lg shadow-[#ffd700]/20 scale-[1.02]"
                : "bg-gradient-to-r from-[#0f0f0f] to-[#1a1a1a] text-white border-[#2a2a2a] hover:border-[#3a3a3a] hover:from-[#2a2a2a] hover:to-[#1f1f1f] hover:scale-[1.01]"
            )}
            onClick={() => onFunctionSelect('image-to-video')}
            data-testid="button-image-to-video"
          >
            <div className="flex items-center gap-4 w-full">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                selectedFunction === 'image-to-video'
                  ? "bg-black/20"
                  : "bg-[#2a2a2a]"
              )}>
                <Video className="w-5 h-5" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-sm">Product Image to Video</div>
                <div className={cn(
                  "text-xs mt-1 leading-relaxed",
                  selectedFunction === 'image-to-video'
                    ? "text-black/70"
                    : "text-[#888888]"
                )}>
                  Create engaging videos with animations & effects
                </div>
              </div>
            </div>
          </Button>
        </div>

        <Separator className="bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent" />
        
        {/* Enhanced Chat Section Header */}
        <div className="flex items-center gap-3 mt-5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/20 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-[#ffd700]" />
          </div>
          <h3 className="font-semibold text-white text-lg">Chat History</h3>
        </div>
        
        {/* Enhanced New Chat Button */}
        <Button 
          onClick={() => createConversationMutation.mutate()}
          disabled={createConversationMutation.isPending}
          className="w-full bg-gradient-to-r from-[#ffd700] to-[#ffed4a] hover:from-[#ffed4a] hover:to-[#ffd700] text-black font-semibold mb-4 h-11 rounded-xl shadow-lg shadow-[#ffd700]/20 transition-all duration-300 hover:scale-[1.02]"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4 mr-2" />
          {createConversationMutation.isPending ? 'Creating...' : 'New Chat'}
        </Button>

        {/* Enhanced Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#666666]" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gradient-to-r from-[#0f0f0f] to-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#666666] rounded-xl focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700]/50 transition-all duration-300"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      {/* Enhanced Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {Object.entries(groupedConversations).length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#3a3a3a] flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-[#666666]" />
              </div>
              <h4 className="text-sm font-medium text-[#cccccc] mb-2">No conversations yet</h4>
              <p className="text-xs text-[#666666] leading-relaxed">
                Start a new chat to begin<br />creating amazing content!
              </p>
            </div>
          ) : (
            Object.entries(groupedConversations)
              .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
              .map(([date, groupConversations]) => (
                <div key={date} className="mb-6">
                  {/* Enhanced Date Header */}
                  <div className="flex items-center gap-3 px-3 py-2 mb-3">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#3a3a3a] flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-[#888888]" />
                    </div>
                    <span className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                      {formatDate(date)}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a2a] to-transparent"></div>
                  </div>
                  
                  {/* Enhanced Conversations */}
                  {groupConversations
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((conversation) => (
                      <Card 
                        key={conversation.id}
                        className={cn(
                          "group mb-3 cursor-pointer transition-all duration-300 rounded-xl border hover:shadow-lg hover:scale-[1.02]",
                          currentConversationId === conversation.id 
                            ? "bg-gradient-to-r from-[#ffd700]/20 to-[#ffd700]/5 border-[#ffd700] shadow-lg shadow-[#ffd700]/10" 
                            : "bg-gradient-to-r from-[#0f0f0f] to-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a] hover:from-[#1a1a1a] hover:to-[#1f1f1f]"
                        )}
                        onClick={() => onConversationSelect(conversation)}
                        data-testid={`conversation-card-${conversation.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className={cn(
                                "text-sm font-semibold truncate mb-2 transition-colors",
                                currentConversationId === conversation.id 
                                  ? "text-[#ffd700]" 
                                  : "text-white group-hover:text-[#e0e0e0]"
                              )}>
                                {conversation.title}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-[#888888]">
                                <Clock className="w-3 h-3" />
                                <span>{formatTime(conversation.createdAt)}</span>
                              </div>
                            </div>
                            <div className={cn(
                              "w-2 h-2 rounded-full transition-colors ml-3 mt-1",
                              currentConversationId === conversation.id
                                ? "bg-[#ffd700]"
                                : "bg-[#444444] group-hover:bg-[#666666]"
                            )}></div>
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