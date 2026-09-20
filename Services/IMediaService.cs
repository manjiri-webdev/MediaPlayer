using MediaPlayer.Models;

namespace MediaPlayer.Services
{
    public interface IMediaService
    {
        List<MediaFile> GetAllMedia();

        List<MediaFile> GetAudioFiles();

        List<MediaFile> GetVideoFiles();

        MediaFile? GetMediaById(string id);

        List<MediaFile> SearchMedia(string query);
    }
}