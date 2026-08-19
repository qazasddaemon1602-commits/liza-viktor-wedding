export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bunker_final_attempts: {
        Row: {
          correct: boolean
          created_at: string
          event_id: string
          guest_id: string | null
          id: number
          run_nonce: string
          submitted_code_hash: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          event_id: string
          guest_id?: string | null
          id?: number
          run_nonce: string
          submitted_code_hash: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          event_id?: string
          guest_id?: string | null
          id?: number
          run_nonce?: string
          submitted_code_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "bunker_final_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bunker_final_attempts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      bunker_guest_profiles: {
        Row: {
          baggage: string
          created_at: string
          event_id: string
          guest_id: string
          health: string
          hidden_fact: string
          hobby: string
          id: string
          profession: string
          profile: string
          run_nonce: string
        }
        Insert: {
          baggage: string
          created_at?: string
          event_id: string
          guest_id: string
          health: string
          hidden_fact: string
          hobby: string
          id?: string
          profession: string
          profile: string
          run_nonce: string
        }
        Update: {
          baggage?: string
          created_at?: string
          event_id?: string
          guest_id?: string
          health?: string
          hidden_fact?: string
          hobby?: string
          id?: string
          profession?: string
          profile?: string
          run_nonce?: string
        }
        Relationships: [
          {
            foreignKeyName: "bunker_guest_profiles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bunker_guest_profiles_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      bunker_mission_templates: {
        Row: {
          carriage_number: number
          correct_answer: string
          hint_copy: string
          id: string
          options: Json
          prompt: string
          stage: string
          success_copy: string
          title: string
        }
        Insert: {
          carriage_number: number
          correct_answer: string
          hint_copy: string
          id?: string
          options?: Json
          prompt: string
          stage: string
          success_copy: string
          title: string
        }
        Update: {
          carriage_number?: number
          correct_answer?: string
          hint_copy?: string
          id?: string
          options?: Json
          prompt?: string
          stage?: string
          success_copy?: string
          title?: string
        }
        Relationships: []
      }
      bunker_state: {
        Row: {
          duration_seconds: number
          event_id: string
          phase: string
          phase_started_at: string | null
          run_nonce: string | null
          sound_enabled: boolean
          started_at: string | null
          status: string
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          duration_seconds?: number
          event_id: string
          phase?: string
          phase_started_at?: string | null
          run_nonce?: string | null
          sound_enabled?: boolean
          started_at?: string | null
          status?: string
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          duration_seconds?: number
          event_id?: string
          phase?: string
          phase_started_at?: string | null
          run_nonce?: string | null
          sound_enabled?: boolean
          started_at?: string | null
          status?: string
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bunker_state_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      bunker_team_progress: {
        Row: {
          attempt_count: number
          carriage_id: string
          completed_at: string | null
          completed_by_guest_id: string | null
          event_id: string
          id: string
          mission_template_id: string
          reward_fragment: string | null
          run_nonce: string
          stage: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          carriage_id: string
          completed_at?: string | null
          completed_by_guest_id?: string | null
          event_id: string
          id?: string
          mission_template_id: string
          reward_fragment?: string | null
          run_nonce: string
          stage: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          carriage_id?: string
          completed_at?: string | null
          completed_by_guest_id?: string | null
          event_id?: string
          id?: string
          mission_template_id?: string
          reward_fragment?: string | null
          run_nonce?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bunker_team_progress_carriage_id_fkey"
            columns: ["carriage_id"]
            isOneToOne: false
            referencedRelation: "carriages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bunker_team_progress_completed_by_guest_id_fkey"
            columns: ["completed_by_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bunker_team_progress_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bunker_team_progress_mission_template_id_fkey"
            columns: ["mission_template_id"]
            isOneToOne: false
            referencedRelation: "bunker_mission_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      carriage_call_targets: {
        Row: {
          call_id: string
          carriage_id: string
        }
        Insert: {
          call_id: string
          carriage_id: string
        }
        Update: {
          call_id?: string
          carriage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carriage_call_targets_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "carriage_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carriage_call_targets_carriage_id_fkey"
            columns: ["carriage_id"]
            isOneToOne: false
            referencedRelation: "carriages"
            referencedColumns: ["id"]
          },
        ]
      }
      carriage_calls: {
        Row: {
          active: boolean
          cleared_at: string | null
          created_at: string
          created_by: string
          event_id: string
          id: string
          message: string
          show_on_screen: boolean
        }
        Insert: {
          active?: boolean
          cleared_at?: string | null
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          message: string
          show_on_screen?: boolean
        }
        Update: {
          active?: boolean
          cleared_at?: string | null
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          message?: string
          show_on_screen?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "carriage_calls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      carriages: {
        Row: {
          accent_hex: string
          enabled: boolean
          event_id: string
          id: string
          label: string
          number: number
          sort_order: number
          visual_mark: string
        }
        Insert: {
          accent_hex: string
          enabled?: boolean
          event_id: string
          id?: string
          label: string
          number: number
          sort_order: number
          visual_mark: string
        }
        Update: {
          accent_hex?: string
          enabled?: boolean
          event_id?: string
          id?: string
          label?: string
          number?: number
          sort_order?: number
          visual_mark?: string
        }
        Relationships: [
          {
            foreignKeyName: "carriages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_preanswer_access: {
        Row: {
          consumed_at: string | null
          event_id: string
          finalized_at: string | null
          issued_at: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          consumed_at?: string | null
          event_id: string
          finalized_at?: string | null
          issued_at?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          consumed_at?: string | null
          event_id?: string
          finalized_at?: string | null
          issued_at?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_preanswer_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_preanswers: {
        Row: {
          choice: string
          event_id: string
          question_id: string
          updated_at: string
        }
        Insert: {
          choice: string
          event_id: string
          question_id: string
          updated_at?: string
        }
        Update: {
          choice?: string
          event_id?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_preanswers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_preanswers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_state: {
        Row: {
          current_module: string
          event_id: string
          screen_mode: string
          screen_payload: Json | null
          screen_payload_id: string | null
          screen_pinned: boolean
          updated_at: string
        }
        Insert: {
          current_module?: string
          event_id: string
          screen_mode?: string
          screen_payload?: Json | null
          screen_payload_id?: string | null
          screen_pinned?: boolean
          updated_at?: string
        }
        Update: {
          current_module?: string
          event_id?: string
          screen_mode?: string
          screen_payload?: Json | null
          screen_payload_id?: string | null
          screen_pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_state_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          composition_locked: boolean
          created_at: string
          event_date: string
          expected_guest_count: number
          id: string
          name: string
          next_ticket_sequence: number
          owner_user_id: string
          registration_open: boolean
          slug: string
          wedding_date: string
        }
        Insert: {
          composition_locked?: boolean
          created_at?: string
          event_date?: string
          expected_guest_count?: number
          id?: string
          name: string
          next_ticket_sequence?: number
          owner_user_id: string
          registration_open?: boolean
          slug: string
          wedding_date?: string
        }
        Update: {
          composition_locked?: boolean
          created_at?: string
          event_date?: string
          expected_guest_count?: number
          id?: string
          name?: string
          next_ticket_sequence?: number
          owner_user_id?: string
          registration_open?: boolean
          slug?: string
          wedding_date?: string
        }
        Relationships: []
      }
      final_five_answers: {
        Row: {
          answered_at: string
          choice: string
          event_id: string
          question_id: string
          role: string
          updated_at: string
        }
        Insert: {
          answered_at?: string
          choice: string
          event_id: string
          question_id: string
          role: string
          updated_at?: string
        }
        Update: {
          answered_at?: string
          choice?: string
          event_id?: string
          question_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_five_answers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_five_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      final_five_role_access: {
        Row: {
          event_id: string
          issued_at: string
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          event_id: string
          issued_at?: string
          revoked_at?: string | null
          role: string
          token_hash: string
        }
        Update: {
          event_id?: string
          issued_at?: string
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_five_role_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_device_bindings: {
        Row: {
          created_at: string
          device_key_hash: string
          event_id: string
          guest_id: string
        }
        Insert: {
          created_at?: string
          device_key_hash: string
          event_id: string
          guest_id: string
        }
        Update: {
          created_at?: string
          device_key_hash?: string
          event_id?: string
          guest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_device_bindings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_device_bindings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_recovery_codes: {
        Row: {
          consumed_at: string | null
          created_at: string
          event_id: string
          expires_at: string
          guest_id: string
          id: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          event_id: string
          expires_at: string
          guest_id: string
          id?: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          event_id?: string
          expires_at?: string
          guest_id?: string
          id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_recovery_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_recovery_codes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          affiliation_detail: string | null
          affiliation_type: string
          carriage_id: string
          event_id: string
          first_name: string
          id: string
          last_name: string
          last_seen_at: string
          registered_at: string
          ticket_number: string
          ticket_sequence: number
        }
        Insert: {
          affiliation_detail?: string | null
          affiliation_type: string
          carriage_id: string
          event_id: string
          first_name: string
          id?: string
          last_name: string
          last_seen_at?: string
          registered_at?: string
          ticket_number: string
          ticket_sequence: number
        }
        Update: {
          affiliation_detail?: string | null
          affiliation_type?: string
          carriage_id?: string
          event_id?: string
          first_name?: string
          id?: string
          last_name?: string
          last_seen_at?: string
          registered_at?: string
          ticket_number?: string
          ticket_sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "guests_carriage_id_fkey"
            columns: ["carriage_id"]
            isOneToOne: false
            referencedRelation: "carriages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      mk_matches: {
        Row: {
          created_at: string
          id: string
          match_key: string
          player1_guest_id: string | null
          player2_guest_id: string | null
          position: number
          round: string
          status: string
          tournament_id: string
          updated_at: string
          winner_guest_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_key: string
          player1_guest_id?: string | null
          player2_guest_id?: string | null
          position: number
          round: string
          status?: string
          tournament_id: string
          updated_at?: string
          winner_guest_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_key?: string
          player1_guest_id?: string | null
          player2_guest_id?: string | null
          position?: number
          round?: string
          status?: string
          tournament_id?: string
          updated_at?: string
          winner_guest_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mk_matches_player1_guest_id_fkey"
            columns: ["player1_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk_matches_player2_guest_id_fkey"
            columns: ["player2_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mk_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk_matches_winner_guest_id_fkey"
            columns: ["winner_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      mk_registrations: {
        Row: {
          display_name: string
          guest_id: string
          id: string
          registered_at: string
          seed: number | null
          status: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          display_name: string
          guest_id: string
          id?: string
          registered_at?: string
          seed?: number | null
          status: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          guest_id?: string
          id?: string
          registered_at?: string
          seed?: number | null
          status?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk_registrations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mk_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mk_tournaments: {
        Row: {
          champion_guest_id: string | null
          created_at: string
          current_match_id: string | null
          event_id: string
          id: string
          max_players: number
          state: string
          updated_at: string
        }
        Insert: {
          champion_guest_id?: string | null
          created_at?: string
          current_match_id?: string | null
          event_id: string
          id?: string
          max_players?: number
          state?: string
          updated_at?: string
        }
        Update: {
          champion_guest_id?: string | null
          created_at?: string
          current_match_id?: string | null
          event_id?: string
          id?: string
          max_players?: number
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mk_current_match_fk"
            columns: ["current_match_id"]
            isOneToOne: false
            referencedRelation: "mk_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk_tournaments_champion_guest_id_fkey"
            columns: ["champion_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mk_tournaments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_action_log: {
        Row: {
          action: string
          created_at: string
          event_id: string
          id: number
          owner_user_id: string
          payload: Json
        }
        Insert: {
          action: string
          created_at?: string
          event_id: string
          id?: number
          owner_user_id: string
          payload?: Json
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string
          id?: number
          owner_user_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "owner_action_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      premiere_state: {
        Row: {
          countdown_seconds: number
          countdown_sound_enabled: boolean
          duration_seconds: number | null
          event_id: string
          media_url: string | null
          playback_anchor_at: string | null
          playback_offset_seconds: number
          start_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          countdown_seconds?: number
          countdown_sound_enabled?: boolean
          duration_seconds?: number | null
          event_id: string
          media_url?: string | null
          playback_anchor_at?: string | null
          playback_offset_seconds?: number
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          countdown_seconds?: number
          countdown_sound_enabled?: boolean
          duration_seconds?: number | null
          event_id?: string
          media_url?: string | null
          playback_anchor_at?: string | null
          playback_offset_seconds?: number
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premiere_state_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          created_at: string
          enabled: boolean
          event_id: string
          id: string
          image_path: string | null
          question_type: string
          sort_order: number
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_id: string
          id?: string
          image_path?: string | null
          question_type?: string
          sort_order: number
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_id?: string
          id?: string
          image_path?: string | null
          question_type?: string
          sort_order?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_state: {
        Row: {
          activated_at: string | null
          couple_answer_revealed_at: string | null
          current_question_id: string | null
          event_id: string
          final_five_revealed_at: string | null
          phase: string
          revealed_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          couple_answer_revealed_at?: string | null
          current_question_id?: string | null
          event_id: string
          final_five_revealed_at?: string | null
          phase?: string
          revealed_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          couple_answer_revealed_at?: string | null
          current_question_id?: string | null
          event_id?: string
          final_five_revealed_at?: string | null
          phase?: string
          revealed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_state_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_state_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_votes: {
        Row: {
          choice: string
          created_at: string
          event_id: string
          guest_id: string
          id: string
          question_id: string
        }
        Insert: {
          choice: string
          created_at?: string
          event_id: string
          guest_id: string
          id?: string
          question_id: string
        }
        Update: {
          choice?: string
          created_at?: string
          event_id?: string
          guest_id?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_votes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_events: {
        Row: {
          created_at: string
          event_id: string
          event_slug: string
          expires_at: string
          id: string
          kind: string
          payload: Json
          public_visible: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          event_slug: string
          expires_at: string
          id?: string
          kind: string
          payload?: Json
          public_visible?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          event_slug?: string
          expires_at?: string
          id?: string
          kind?: string
          payload?: Json
          public_visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "screen_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _bunker_guest_id: {
        Args: { p_device_key: string; p_event_slug: string }
        Returns: string
      }
      _couple_preanswer_token_hash: {
        Args: { p_token: string }
        Returns: string
      }
      _device_hash: { Args: { device_key: string }; Returns: string }
      _ensure_bunker_guest_profile: {
        Args: { p_event_id: string; p_guest_id: string; p_run_nonce: string }
        Returns: undefined
      }
      _ensure_bunker_team_progress: {
        Args: { p_event_id: string; p_run_nonce: string }
        Returns: undefined
      }
      _final_five_token_hash: { Args: { p_token: string }; Returns: string }
      _guest_profile_json: { Args: { guest_id: string }; Returns: Json }
      _mk_next_match: {
        Args: { p_position: number; p_round: string }
        Returns: {
          next_position: number
          next_round: string
          next_slot: string
        }[]
      }
      _normalize_spaces: { Args: { value: string }; Returns: string }
      _premiere_clamp_position: {
        Args: { p_duration: number; p_position: number }
        Returns: number
      }
      _require_bunker_owner: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      _require_mk_owner: { Args: { p_event_id: string }; Returns: undefined }
      _require_premiere_owner: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      finalize_couple_preanswers: {
        Args: { p_event_slug: string; p_token: string }
        Returns: Json
      }
      get_bunker_screen_state: { Args: { p_event_slug: string }; Returns: Json }
      get_couple_preanswer_form: {
        Args: { p_event_slug: string; p_token: string }
        Returns: Json
      }
      get_final_five_role_state: {
        Args: { p_event_slug: string; p_role: string; p_token: string }
        Returns: Json
      }
      get_guest_active_carriage_calls: {
        Args: { p_device_key: string; p_event_slug: string }
        Returns: Json
      }
      get_guest_bunker_state: {
        Args: { p_device_key: string; p_event_slug: string }
        Returns: Json
      }
      get_mk_tournament_state: {
        Args: { p_device_key?: string; p_event_slug: string }
        Returns: Json
      }
      get_premiere_screen_state: {
        Args: { p_event_slug: string }
        Returns: Json
      }
      get_quiz_screen_state: { Args: { p_event_slug: string }; Returns: Json }
      get_quiz_state: {
        Args: { p_device_key: string; p_event_slug: string }
        Returns: Json
      }
      get_revealed_couple_answer: {
        Args: { p_event_slug: string }
        Returns: Json
      }
      get_revealed_final_five: { Args: { p_event_slug: string }; Returns: Json }
      join_mk_tournament: {
        Args: { p_device_key: string; p_event_slug: string }
        Returns: Json
      }
      owner_activate_quiz_question: {
        Args: { p_event_id: string; p_question_id: string }
        Returns: Json
      }
      owner_advance_bunker_phase: {
        Args: { p_event_id: string; p_phase: string }
        Returns: Json
      }
      owner_begin_bunker_quest: { Args: { p_event_id: string }; Returns: Json }
      owner_cancel_premiere: { Args: { p_event_id: string }; Returns: Json }
      owner_clear_carriage_call: { Args: { p_call_id: string }; Returns: Json }
      owner_close_mk_registration: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_create_event: {
        Args: { p_name: string; p_slug: string }
        Returns: Json
      }
      owner_delete_guest: { Args: { p_guest_id: string }; Returns: Json }
      owner_finalize_mk_draw: { Args: { p_event_id: string }; Returns: Json }
      owner_force_complete_bunker_team_stage: {
        Args: { p_carriage_id: string; p_event_id: string; p_stage: string }
        Returns: Json
      }
      owner_get_bunker_control: { Args: { p_event_id: string }; Returns: Json }
      owner_get_bunker_quest: { Args: { p_event_id: string }; Returns: Json }
      owner_get_couple_preanswer_status: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_get_couple_reveal_status: {
        Args: { p_event_id: string; p_question_id: string }
        Returns: Json
      }
      owner_get_dashboard: { Args: { p_event_slug: string }; Returns: Json }
      owner_get_final_five_status: {
        Args: { p_event_id: string; p_question_id: string }
        Returns: Json
      }
      owner_get_mk_control: { Args: { p_event_id: string }; Returns: Json }
      owner_get_premiere_control: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_get_quiz_control: { Args: { p_event_id: string }; Returns: Json }
      owner_issue_couple_preanswer_access: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_issue_final_five_role_access: {
        Args: { p_event_id: string; p_role: string }
        Returns: Json
      }
      owner_issue_guest_recovery: {
        Args: { p_guest_id: string }
        Returns: Json
      }
      owner_lock_composition: { Args: { p_event_id: string }; Returns: Json }
      owner_open_mk_registration: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_pause_premiere: { Args: { p_event_id: string }; Returns: Json }
      owner_promote_mk_waitlist: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      owner_publish_carriage_call_screen_event: {
        Args: { p_call_id: string }
        Returns: Json
      }
      owner_randomize_mk_seeds: { Args: { p_event_id: string }; Returns: Json }
      owner_reassign_guest: {
        Args: { p_carriage_id: string; p_guest_id: string }
        Returns: Json
      }
      owner_record_mk_winner: {
        Args: {
          clear_completed_downstream?: boolean
          p_match_id: string
          p_winner_guest_id: string
        }
        Returns: Json
      }
      owner_remove_mk_player: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      owner_replace_mk_player: {
        Args: { p_guest_id: string; p_registration_id: string }
        Returns: Json
      }
      owner_reset_bunker_team_stage: {
        Args: { p_carriage_id: string; p_event_id: string; p_stage: string }
        Returns: Json
      }
      owner_reset_event_test_data: {
        Args: { p_confirmation: string; p_event_id: string }
        Returns: Json
      }
      owner_restart_premiere: { Args: { p_event_id: string }; Returns: Json }
      owner_resume_premiere: { Args: { p_event_id: string }; Returns: Json }
      owner_return_main_screen: { Args: { p_event_id: string }; Returns: Json }
      owner_reveal_couple_preanswer: {
        Args: { p_event_id: string; p_question_id: string }
        Returns: Json
      }
      owner_reveal_final_five: {
        Args: { p_event_id: string; p_question_id: string }
        Returns: Json
      }
      owner_reveal_quiz_results: {
        Args: { p_event_id: string; p_question_id: string }
        Returns: Json
      }
      owner_seed_default_quiz_questions: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_seed_final_five_questions: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_seek_premiere: {
        Args: { p_event_id: string; p_position_seconds: number }
        Returns: Json
      }
      owner_send_carriage_call: {
        Args: {
          p_carriage_ids: string[]
          p_event_id: string
          p_message: string
          p_show_on_screen?: boolean
        }
        Returns: Json
      }
      owner_set_bunker_sound: {
        Args: { p_enabled: boolean; p_event_id: string }
        Returns: Json
      }
      owner_set_current_mk_match: {
        Args: { p_match_id: string }
        Returns: Json
      }
      owner_set_mk_main_screen: {
        Args: { p_enabled: boolean; p_event_id: string }
        Returns: Json
      }
      owner_set_premiere_black: { Args: { p_event_id: string }; Returns: Json }
      owner_set_premiere_countdown_sound: {
        Args: { p_enabled: boolean; p_event_id: string }
        Returns: Json
      }
      owner_set_premiere_media: {
        Args: {
          p_duration_seconds: number
          p_event_id: string
          p_media_url: string
        }
        Returns: Json
      }
      owner_set_premiere_standby: {
        Args: { p_event_id: string }
        Returns: Json
      }
      owner_show_mk_bracket: { Args: { p_event_id: string }; Returns: Json }
      owner_start_bunker: {
        Args: { p_duration_seconds?: number; p_event_id: string }
        Returns: Json
      }
      owner_start_premiere: {
        Args: { p_countdown_seconds: number; p_event_id: string }
        Returns: Json
      }
      owner_stop_bunker: { Args: { p_event_id: string }; Returns: Json }
      owner_swap_mk_seeds: {
        Args: { p_registration_a: string; p_registration_b: string }
        Returns: Json
      }
      owner_undo_mk_result: {
        Args: { clear_completed_downstream?: boolean; p_match_id: string }
        Returns: Json
      }
      owner_unlock_bunker: { Args: { p_event_id: string }; Returns: Json }
      recover_guest: {
        Args: {
          p_device_key: string
          p_event_slug: string
          p_recovery_code: string
        }
        Returns: Json
      }
      register_guest: {
        Args: {
          p_affiliation_detail?: string
          p_affiliation_type: string
          p_confirm_duplicate?: boolean
          p_device_key: string
          p_event_slug: string
          p_first_name: string
          p_last_name: string
        }
        Returns: Json
      }
      restore_guest: {
        Args: { p_device_key: string; p_event_slug: string }
        Returns: Json
      }
      save_couple_preanswer: {
        Args: {
          p_choice: string
          p_event_slug: string
          p_question_id: string
          p_token: string
        }
        Returns: Json
      }
      submit_final_five_answer: {
        Args: {
          p_choice: string
          p_event_slug: string
          p_question_id: string
          p_role: string
          p_token: string
        }
        Returns: Json
      }
      submit_guest_bunker_final_code: {
        Args: { p_code: string; p_device_key: string; p_event_slug: string }
        Returns: Json
      }
      submit_guest_bunker_mission: {
        Args: {
          p_answer: string
          p_device_key: string
          p_event_slug: string
          p_stage: string
        }
        Returns: Json
      }
      submit_quiz_vote: {
        Args: {
          p_choice: string
          p_device_key: string
          p_event_slug: string
          p_question_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
