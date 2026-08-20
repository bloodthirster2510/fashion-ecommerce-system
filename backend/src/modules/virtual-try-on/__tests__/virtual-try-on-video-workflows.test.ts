import { existsSync } from 'fs';
import {
  getVideoWorkflowOptions,
  inferVideoWorkflowProfile,
  transformVideoWorkflowInput,
} from '../providers/virtual-try-on-video-workflows';

describe('virtual try-on video workflow profiles', () => {
  it('ships a readable workflow and map for every admin option', () => {
    const workflows = getVideoWorkflowOptions();

    expect(workflows.map((workflow) => workflow.id)).toEqual(['fast', 'balanced', 'quality']);
    workflows.forEach((workflow) => {
      expect(existsSync(workflow.workflowPath)).toBe(true);
      expect(existsSync(workflow.workflowMapPath)).toBe(true);
      expect(workflow.model).toBeTruthy();
    });
  });

  it('keeps legacy jobs on the current quality workflow', () => {
    expect(inferVideoWorkflowProfile(undefined, 'kling-v3-omni')).toBe('quality');
    expect(inferVideoWorkflowProfile(undefined, 'viduq2-turbo')).toBe('fast');
    expect(inferVideoWorkflowProfile(undefined, 'kling-v2-5-turbo')).toBe('balanced');
  });

  it('maps arbitrary admin duration to Kling 2.5 supported values', () => {
    expect(transformVideoWorkflowInput('balanced', 'duration', 5)).toBe('5');
    expect(transformVideoWorkflowInput('balanced', 'duration', 12)).toBe('10');
    expect(transformVideoWorkflowInput('fast', 'duration', 6)).toBe(6);
  });
});
