import { supabase } from '../src/services/supabaseClient';
import { PromptVersion } from '../types';

export const ShareService = {
    /**
     * Publishes a prompt version by generating a share token and setting is_public to true.
     * If already shared, returns the existing token.
     */
    async publishVersion(id: string): Promise<string> {
        // 1. Check if already shared
        const { data: current } = await supabase
            .from('prompt_versions')
            .select('share_token')
            .eq('id', id)
            .single();

        if (current?.share_token) {
            return current.share_token;
        }

        // 2. Generate new token
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // 3. Update record
        const { error } = await supabase
            .from('prompt_versions')
            .update({
                is_public: true,
                share_token: token
            })
            .eq('id', id);

        if (error) throw error;
        return token;
    },

    /**
     * Fetches a shared prompt by token.
     * RLS ensures we can only see it if is_public = true (or if we are the owner, but anon policy covers public).
     */
    async getSharedPrompt(token: string): Promise<PromptVersion | null> {
        const { data, error } = await supabase
            .from('prompt_versions')
            .select('*')
            .eq('share_token', token)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            version: data.version_label || 'vShared',
            tag: 'Shared',
            message: data.version_label || 'Shared Prompt',
            content: data.content,
            author: data.author || 'Anonymous',
            timestamp: data.created_at,
            hash: 'shared',
            rating: data.metadata?.rating
        };
    }
};
