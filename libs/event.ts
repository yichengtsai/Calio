export type Event = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string; // ISO string
  end_time: string;
  color: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
};