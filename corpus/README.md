# Legal corpus ingestion

`sources.json` is a registry, not a verified legal corpus. The API intentionally returns no verified legal citations until a source passage has been downloaded, checksummed, sectioned, and reviewed.

The ingestion job that should be added next must:

1. Fetch only approved official URLs and respect their terms and robots rules.
2. Store retrieval date, checksum, source authority, jurisdiction and effective dates.
3. Split legislation by section, subsection and proviso rather than fixed windows.
4. Write `legal_sources` and `legal_source_chunks` through an authenticated backend path.
5. Run citation verification tests, including a fake-section refusal test.

Never place real user documents in this folder. Matter documents belong in private storage.
