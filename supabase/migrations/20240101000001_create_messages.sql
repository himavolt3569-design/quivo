-- Migration: Create messages table for real-time chat

-- 1. Create the messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy: Users can view messages where they are the sender or the receiver
CREATE POLICY "Users can view their own messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: Users can insert messages where they are the sender
CREATE POLICY "Users can send messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Policy: Users can update messages (e.g., mark as read) where they are the receiver
CREATE POLICY "Users can update received messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = receiver_id);

-- 4. Enable Supabase Realtime for the messages table
-- This allows clients to subscribe to changes on this table.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
