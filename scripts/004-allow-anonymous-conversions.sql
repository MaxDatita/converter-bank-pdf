-- Update RLS policy for conversion_history to allow anonymous conversions
DROP POLICY IF EXISTS "Users can insert own conversion history" ON conversion_history;

-- Create new policy that allows both authenticated and anonymous users
CREATE POLICY "Users can insert conversion history" ON conversion_history
    FOR INSERT WITH CHECK (
        -- Allow if user is authenticated and user_id matches auth.uid()
        (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text) OR
        -- Allow if user is anonymous (no auth.uid()) and user_id is null
        (auth.uid() IS NULL AND user_id IS NULL)
    );

-- Also update the SELECT policy to allow anonymous users to view their own conversions
DROP POLICY IF EXISTS "Users can view own conversion history" ON conversion_history;

CREATE POLICY "Users can view conversion history" ON conversion_history
    FOR SELECT USING (
        -- Allow if user is authenticated and user_id matches auth.uid()
        (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text) OR
        -- Allow if user is anonymous (no auth.uid()) and user_id is null
        (auth.uid() IS NULL AND user_id IS NULL)
    );
