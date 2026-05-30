// src/lib/stores/workflow.store.ts
// Workflow State Management - Tracks user journey through Create → Refine → Animate
import { writable } from 'svelte/store';

export interface WorkflowContext {
	// What they're creating
	contentType: 'avatar' | 'logo' | 'content' | 'social-post' | 'banner' | 'flyer' | 'product' | 'other' | null;
	
	// User preferences extracted from conversation
	userIntent: string; // "professional", "artistic", "fun", "commercial", etc.
	style: string; // "photorealistic", "impressionist", "minimalist", etc.
	purpose: string; // What they're using it for
	targetAudience: string; // Who it's for
	
	// Workflow progress tracking
	workflowPath: Array<{
		tool: 'create' | 'refine' | 'animate';
		status: 'pending' | 'in-progress' | 'complete';
		assetUrl?: string; // URL of generated asset at this stage
		timestamp?: number;
	}>;
	currentStep: number; // 0 = create, 1 = refine, 2 = animate
	
	// Chat history with prompt coach
	chatHistory: Array<{
		role: 'user' | 'assistant';
		content: string;
		timestamp: number;
	}>;
	
	// Generated prompt from coach
	generatedPrompt: string | null;
	promptQuality: 'draft' | 'good' | 'excellent' | null; // AI-assessed quality
	
	// Session tracking
	sessionStarted: number;
	lastActivity: number;
}

const initialState: WorkflowContext = {
	contentType: null,
	userIntent: '',
	style: '',
	purpose: '',
	targetAudience: '',
	workflowPath: [
		{ tool: 'create', status: 'pending' },
		{ tool: 'refine', status: 'pending' },
		{ tool: 'animate', status: 'pending' }
	],
	currentStep: 0,
	chatHistory: [],
	generatedPrompt: null,
	promptQuality: null,
	sessionStarted: Date.now(),
	lastActivity: Date.now()
};

function createWorkflowStore() {
	const { subscribe, set, update } = writable<WorkflowContext>(initialState);

	return {
		subscribe,
		
		// Reset everything (new session)
		reset: () => set({ 
			...initialState, 
			sessionStarted: Date.now(),
			lastActivity: Date.now()
		}),
		
		// Context setters
		setContentType: (type: WorkflowContext['contentType']) =>
			update((state) => ({ 
				...state, 
				contentType: type,
				lastActivity: Date.now()
			})),
			
		setIntent: (intent: string) => 
			update((state) => ({ 
				...state, 
				userIntent: intent,
				lastActivity: Date.now()
			})),
			
		setStyle: (style: string) => 
			update((state) => ({ 
				...state, 
				style,
				lastActivity: Date.now()
			})),
			
		setPurpose: (purpose: string) => 
			update((state) => ({ 
				...state, 
				purpose,
				lastActivity: Date.now()
			})),
			
		setTargetAudience: (audience: string) =>
			update((state) => ({
				...state,
				targetAudience: audience,
				lastActivity: Date.now()
			})),
		
		// Chat management
		addMessage: (role: 'user' | 'assistant', content: string) =>
			update((state) => ({
				...state,
				chatHistory: [
					...state.chatHistory,
					{
						role,
						content,
						timestamp: Date.now()
					}
				],
				lastActivity: Date.now()
			})),
			
		clearChat: () =>
			update((state) => ({
				...state,
				chatHistory: [],
				lastActivity: Date.now()
			})),
		
		// Prompt management
		setGeneratedPrompt: (prompt: string, quality: WorkflowContext['promptQuality'] = 'good') =>
			update((state) => ({ 
				...state, 
				generatedPrompt: prompt,
				promptQuality: quality,
				lastActivity: Date.now()
			})),
			
		clearPrompt: () =>
			update((state) => ({
				...state,
				generatedPrompt: null,
				promptQuality: null,
				lastActivity: Date.now()
			})),
		
		// Workflow progression
		advanceStep: () =>
			update((state) => {
				const nextStep = Math.min(state.currentStep + 1, state.workflowPath.length - 1);
				return {
					...state,
					currentStep: nextStep,
					lastActivity: Date.now()
				};
			}),
			
		goToStep: (step: number) =>
			update((state) => ({
				...state,
				currentStep: Math.max(0, Math.min(step, state.workflowPath.length - 1)),
				lastActivity: Date.now()
			})),
		
		// Update specific step status
		updateStepStatus: (
			step: number,
			status: 'pending' | 'in-progress' | 'complete',
			assetUrl?: string
		) =>
			update((state) => {
				const newPath = [...state.workflowPath];
				if (step >= 0 && step < newPath.length) {
					newPath[step] = { 
						...newPath[step], 
						status, 
						assetUrl,
						timestamp: Date.now()
					};
				}
				return { 
					...state, 
					workflowPath: newPath,
					lastActivity: Date.now()
				};
			}),
			
		// Mark current step as in-progress
		startCurrentStep: () =>
			update((state) => {
				const newPath = [...state.workflowPath];
				newPath[state.currentStep] = {
					...newPath[state.currentStep],
					status: 'in-progress',
					timestamp: Date.now()
				};
				return {
					...state,
					workflowPath: newPath,
					lastActivity: Date.now()
				};
			}),
			
		// Mark current step as complete and advance
		completeCurrentStep: (assetUrl?: string) =>
			update((state) => {
				const newPath = [...state.workflowPath];
				newPath[state.currentStep] = {
					...newPath[state.currentStep],
					status: 'complete',
					assetUrl,
					timestamp: Date.now()
				};
				
				const nextStep = Math.min(state.currentStep + 1, state.workflowPath.length - 1);
				
				return {
					...state,
					workflowPath: newPath,
					currentStep: nextStep,
					lastActivity: Date.now()
				};
			}),
		
		// Bulk update for AI-extracted context
		updateContext: (updates: Partial<WorkflowContext>) =>
			update((state) => ({
				...state,
				...updates,
				lastActivity: Date.now()
			})),
			
		// Get workflow completion percentage
		getCompletionPercentage: (state: WorkflowContext): number => {
			const completed = state.workflowPath.filter(s => s.status === 'complete').length;
			return Math.round((completed / state.workflowPath.length) * 100);
		}
	};
}

export const workflowContext = createWorkflowStore();

// Helper to check if user has enough context to start creating
export function hasMinimumContext(context: WorkflowContext): boolean {
	return !!(
		context.contentType && 
		(context.userIntent || context.style || context.purpose)
	);
}

// Helper to get current tool name
export function getCurrentToolName(context: WorkflowContext): string {
	return context.workflowPath[context.currentStep]?.tool || 'create';
}

// Helper to get next tool name
export function getNextToolName(context: WorkflowContext): string | null {
	const nextStep = context.currentStep + 1;
	return nextStep < context.workflowPath.length 
		? context.workflowPath[nextStep].tool 
		: null;
}