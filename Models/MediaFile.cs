namespace MediaPlayer.Models
{
    public class MediaFile
    {
        public string Id { get; set; } = string.Empty;

        public string FileName { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        public string MediaType { get; set; } = string.Empty;

        public string FilePath { get; set; } = string.Empty;

        public string Extension { get; set; } = string.Empty;
    }
}